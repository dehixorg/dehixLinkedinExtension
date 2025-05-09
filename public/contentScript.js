; (() => {
  const processedPosts = new Set()
  let lastProcessedUrl = location.href
  let observer;

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
    const match = str?.match(/\/in\/([^/?]+)/)
    return match ? match[1] : null
  }

  // Get blocked user IDs and usernames from storage
  const getBlockedUsernamesAndPostIds = () => {
    return new Promise((resolve) => {
      if (!isExtensionContext()) {
        console.log("Running in non-extension context, using empty blocklist")
        return resolve({ usernames: new Set(), postIds: new Set(), spamUsernames: new Set(), spamPostIds: new Set() })
      }

      try {
        chrome.storage.local.get(
          ["reportedPosts", "reportedUsernames", "spamPosts", "spamUsernames"],
          ({ reportedPosts = [], reportedUsernames = [], spamPosts = [], spamUsernames = [] }) => {
            resolve({
              usernames: new Set(reportedUsernames),
              postIds: new Set(reportedPosts),
              spamUsernames: new Set(spamUsernames),
              spamPostIds: new Set(spamPosts),
            })
          },
        )
      } catch (e) {
        console.warn("Chrome storage access error:", e)
        resolve({
          usernames: new Set(),
          postIds: new Set(),
          spamUsernames: new Set(),
          spamPostIds: new Set(),
        })
      }
    })
  }

  // Hide posts and chats of blocked users
  const hideMatchedPostsAndChats = async (status) => {
    if (!status) {
      console.log("Fraud detection is off. Not hiding any posts or chats.")
      return
    }

    const { usernames, postIds, spamUsernames, spamPostIds } = await getBlockedUsernamesAndPostIds()

    // Hide posts in the feed
    const allPosts = [
      ...document.querySelectorAll("div[data-id^='urn:li:activity:']"),
      ...document.querySelectorAll("div[data-urn^='urn:li:activity:']"),
    ]

    allPosts.forEach((post) => {
      const rawId = post.getAttribute("data-id") || post.getAttribute("data-urn")
      const postId = extractPostId(rawId)
      if (!postId) return

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

      // Hide blocked posts and users
      if ((postId && postIds.has(postId)) || (username && usernames.has(username) && !processedPosts.has(postId))) {
        post.style.display = "none"
        post.classList.add("reported-hidden")
        processedPosts.add(postId)
        console.log("Post hidden:", postId, username)
      }

      // Add yellow warning icon for spam posts
      if (postId && spamPostIds.has(postId) && !processedPosts.has(`spam-${postId}`)) {
        const warningIcon = document.createElement("div")
        warningIcon.innerHTML = `
          ❗
        `
        warningIcon.style.cssText = `
          position: absolute;
          top: 6px;
          right: 86px;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #fff3cd;
          border-radius: 50%;
          padding: 4px;
        `
        post.style.position = "relative"
        post.prepend(warningIcon)
        processedPosts.add(`spam-${postId}`)
        console.log("Spam post marked:", postId)
      }

      // Add red warning icon for spam users
      if (username && spamUsernames.has(username) && !processedPosts.has(`spam-user-${username}`)) {
        const warningIcon = document.createElement("div")
        warningIcon.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffc107" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        `
        warningIcon.style.cssText = `
          position: absolute;
         top: 6px;
          right: 86px;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f8d7da;
          border-radius: 50%;
          padding: 4px;
        `
        post.style.position = "relative"
        post.prepend(warningIcon)
        processedPosts.add(`spam-user-${username}`)
        console.log("Spam user marked:", username)
      }
    })

    // Hide chat messages from blocked users
    const allMessages = document.querySelectorAll("div[data-test-id='message-item']")
    allMessages.forEach((message) => {
      const messageSender = message.querySelector("span.actor-name")
      const senderUsername = messageSender ? messageSender.textContent : null

      if (senderUsername && usernames.has(senderUsername)) {
        message.style.display = "none"
      }
    })
  }

  // Hide notifications from blocked users
  const hideMatchedNotifications = async (status) => {
    if (!status) return

    const { usernames } = await getBlockedUsernamesAndPostIds()

    const notifications = document.querySelectorAll("div[notification-card-image]")
    notifications.forEach((notif) => {
      const links = notif.querySelectorAll("a[href*='/in/']")
      let username = null

      for (const a of links) {
        const extracted = extractUsername(a.href)
        if (extracted) {
          const decoded = decodeURIComponent(extracted)
          username = decoded.replace(/\s+/g, "-")
          break
        }
      }

      if (username && usernames.has(username)) {
        notif.style.display = "none"
        console.log("Notification hidden:", username)
      }
    })
  }

  const hideMatchedContent = async (status) => {
    await hideMatchedPostsAndChats(status)
    await hideMatchedNotifications(status)
  }

  // Observe dynamic content (scroll, new posts, chat messages)
  const observeContentChanges = (status) => {
    if (!status) return;

    if (observer) observer.disconnect();

    let timeout
    observer = new MutationObserver(() => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        hideMatchedContent(status)
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
              if (status) {
                hideMatchedContent(status)
              }
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
          hideMatchedContent(status)
          observeContentChanges(status)
          watchUrlChange()
        })

        // Listen for runtime messages from popup
        chrome.runtime.onMessage.addListener((message) => {
          if (message.action === "SETTINGS_UPDATED" || message.action === "RE_EVALUATE_POSTS") {
            chrome.storage.local.get(["status"], ({ status }) => {
              processedPosts.clear() // Clear processed posts to re-evaluate all
              if (observer) observer.disconnect();
              if (status) {
                hideMatchedContent(status)
                observeContentChanges(status)
              }
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
