(() => {
  const API_BASE_URL = "http://localhost:5000/api/users"
  let lastProcessedUrl = location.href
  const processedPosts = new Set()

  // Check if we're in a Chrome extension context
  const isExtensionContext = () => {
    try {
      return (
        typeof chrome !== "undefined" &&
        chrome !== null &&
        chrome.runtime &&
        chrome.runtime.id &&
        chrome.storage &&
        chrome.storage.local
      )
    } catch (e) {
      console.log("Chrome API access error:", e.message)
      return false
    }
  }

  // Extract LinkedIn Post ID
  const extractPostId = (str) => {
    const match = str?.match(/activity[:-](\d+)/)
    return match ? match[1] : null
  }

  // Extract LinkedIn Username from URL or post
  const extractUsername = (str) => {
    const match = str?.match(/\/in\/([^\/?]+)/)
    return match ? match[1] : null
  }

  // Get blocked user IDs and usernames from storage and API
  const getBlockedUsernamesAndPostIds = () => {
    return new Promise((resolve) => {
      if (!isExtensionContext()) {
        console.log("Running in non-extension context, using empty blocklist")
        return resolve({ usernames: new Set(), postIds: new Set() })
      }
  
      try {
        chrome.storage.local.get(["reportedPosts", "reportedUsernames", "uuid"], async ({ reportedPosts = [], reportedUsernames = [], uuid }) => {
          if (uuid) {
            try {
              const res = await fetch(`${API_BASE_URL}/blocked-users/${uuid}?reportType=all`)
              const data = await res.json()
              const apiUsernames = (data?.blockedUsers || []).map((user) => user.userName)
              const apiPostIds = (data?.blockedUsers || []).map((user) => user.postId)
  
              resolve({
                usernames: new Set([...reportedUsernames, ...apiUsernames]),
                postIds: new Set([...reportedPosts, ...apiPostIds]),
              })
            } catch (e) {
              console.warn("API fetch error, falling back to local storage:", e)
              resolve({
                usernames: new Set(reportedUsernames),
                postIds: new Set(reportedPosts),
              })
            }
          } else {
            resolve({
              usernames: new Set(reportedUsernames),
              postIds: new Set(reportedPosts),
            })
          }
        })
      } catch (e) {
        console.warn("Chrome storage access error:", e)
        resolve({ usernames: new Set(), postIds: new Set() })
      }
    })
  }
  

  // Hide posts and chats of blocked users
  const hideMatchedPostsAndChats = async (status) => {
    if (!status) {
      console.log("Fraud detection is off. Not hiding any posts or chats.")
      return
    }

    const { usernames, postIds } = await getBlockedUsernamesAndPostIds()

    // Hide posts in the feed
    const allPosts = [
      ...document.querySelectorAll("div[data-id^='urn:li:activity:']"),
      ...document.querySelectorAll("div[data-urn^='urn:li:activity:']"),
    ]

    allPosts.forEach((post) => {
      const rawId = post.getAttribute("data-id") || post.getAttribute("data-urn")
      const postId = extractPostId(rawId)

      let username = null
      // Existing anchor extraction
      const anchorTags = post.querySelectorAll("a[href*='/in/']")
      for (const a of anchorTags) {
        const extracted = extractUsername(a.href)
        if (extracted) {
          username = extracted
          break
        }
      }

      // Add fallback: Try checking LinkedIn handle from the data-* attributes or divs
      if (!username) {
        const potentialText = post.textContent || ""
        usernames.forEach((blockedUsername) => {
          if (potentialText.includes(blockedUsername)) {
            username = blockedUsername
          }
        })
      }


      if ((postId && postIds.has(postId)) || (username && usernames.has(username)) && !processedPosts.has(postId)) {
        post.style.display = "none"
        post.classList.add("reported-hidden")
        processedPosts.add(postId)
        console.log("Post hidden:", postId, username)
      }
    })


    // Hide chat messages from blocked users
    const allMessages = document.querySelectorAll("div[data-test-id='message-item']")
    allMessages.forEach((message) => {
      const messageSender = message.querySelector("span.actor-name")
      const senderUsername = messageSender ? messageSender.textContent : null

      if (senderUsername && usernames.has(senderUsername)) {
        message.style.display = "none"
        console.log("Message hidden:", senderUsername)
      }
    })

    // Show message when no posts are hidden
    if (allPosts.length === 0) {
      const noPostsMessage = document.createElement("div")
      noPostsMessage.textContent = "No posts to display."
      document.body.appendChild(noPostsMessage)
    }
  }

  // Observe dynamic content (scroll, new posts, chat messages)
  const observeContentChanges = (status) => {
    let timeout
    const observer = new MutationObserver(() => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        hideMatchedPostsAndChats(status)
      }, 100) // debounce to avoid flooding
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  // Handle SPA route changes
  const watchUrlChange = () => {
    setInterval(() => {
      if (location.href !== lastProcessedUrl) {
        lastProcessedUrl = location.href
        processedPosts.clear() // Reset for new page

        if (isExtensionContext()) {
          try {
            chrome.storage.local.get(["status"], ({ status }) => {
              hideMatchedPostsAndChats(status)
            })
          } catch (e) {
            console.warn("Error accessing chrome storage:", e)
          }
        }
      }
    }, 1000)
  }

  // Initialize extension
  const initializeExtension = () => {
    try {
      if (isExtensionContext()) {
        chrome.storage.local.get(["status"], ({ status }) => {
          hideMatchedPostsAndChats(status)
          observeContentChanges(status)
          watchUrlChange()
        })

        // Listen for runtime messages from popup
        chrome.runtime.onMessage.addListener((message) => {
          if (message.action === "SETTINGS_UPDATED") {
            chrome.storage.local.get(["status"], ({ status }) => {
              hideMatchedPostsAndChats(status)
            })
          }
        })
      } else {
        console.log("Not running in extension context, skipping initialization")
      }
    } catch (e) {
      console.warn("Error during extension initialization:", e)
    }
  }

  // Start everything when the page loads
  window.addEventListener("load", initializeExtension)
})()
