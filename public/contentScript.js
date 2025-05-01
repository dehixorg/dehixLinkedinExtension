;(() => {
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

  // Get blocked post IDs from storage and API
  const getBlockedPostIds = () => {
    return new Promise((resolve) => {
      if (!isExtensionContext()) {
        console.log("Running in non-extension context, using empty blocklist")
        return resolve(new Set())
      }

      try {
        chrome.storage.local.get(["reportedPosts", "uuid"], async ({ reportedPosts = [], uuid }) => {
          if (uuid) {
            try {
              const res = await fetch(`${API_BASE_URL}/blocked-posts/${uuid}?reportType=all`)
              const data = await res.json()
              const apiIds = (data?.blockedUsers || []).map((u) => u.postId)
              resolve(new Set([...reportedPosts, ...apiIds]))
            } catch (e) {
              console.warn("API fetch error, falling back to local storage:", e)
              resolve(new Set(reportedPosts))
            }
          } else {
            resolve(new Set(reportedPosts))
          }
        })
      } catch (e) {
        console.warn("Chrome storage access error:", e)
        resolve(new Set())
      }
    })
  }

  // Hide posts with blocked IDs - Only hide when status is ON
  const hideMatchedPosts = async (status, hideFakePosts, hideSuspiciousPosts) => {
    // Skip execution if status is off - don't hide posts when status is off
    if (!status) {
      console.log("Fraud detection is off. Not hiding any posts.")
      return
    }

    // Get blocked IDs only if status is on
    const blockedIds = await getBlockedPostIds()

    const allPosts = [
      ...document.querySelectorAll("div[data-id^='urn:li:activity:']"),
      ...document.querySelectorAll("div[data-urn^='urn:li:activity:']"),
    ]

    allPosts.forEach((post) => {
      const rawId = post.getAttribute("data-id") || post.getAttribute("data-urn")
      const postId = extractPostId(rawId)

      if (postId && blockedIds.has(postId) && !processedPosts.has(postId)) {
        post.style.display = "none"
        post.classList.add("reported-hidden")
        processedPosts.add(postId)
        console.log("Post hidden:", postId)
      }
    })

    // Show message when no posts are hidden
    if (allPosts.length === 0) {
      const noPostsMessage = document.createElement("div")
      noPostsMessage.textContent = "No posts to display."
      document.body.appendChild(noPostsMessage)
    }
  }

  // Observe dynamic content (scroll, new posts)
  const observePostChanges = (status, hideFakePosts, hideSuspiciousPosts) => {
    let timeout
    const observer = new MutationObserver(() => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        hideMatchedPosts(status, hideFakePosts, hideSuspiciousPosts)
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
            chrome.storage.local.get(
              ["status", "hideFakePosts", "hideSuspiciousPosts"],
              ({ status, hideFakePosts, hideSuspiciousPosts }) => {
                hideMatchedPosts(status, hideFakePosts, hideSuspiciousPosts)
              },
            )
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
        chrome.storage.local.get(
          ["status", "hideFakePosts", "hideSuspiciousPosts"],
          ({ status, hideFakePosts, hideSuspiciousPosts }) => {
            // Only start observers - actual hiding depends on status
            hideMatchedPosts(status, hideFakePosts, hideSuspiciousPosts)
            observePostChanges(status, hideFakePosts, hideSuspiciousPosts)
            watchUrlChange()
          },
        )

        // Listen for runtime messages from popup
        chrome.runtime.onMessage.addListener((message) => {
          if (message.action === "SETTINGS_UPDATED") {
            chrome.storage.local.get(
              ["status", "hideFakePosts", "hideSuspiciousPosts"],
              ({ status, hideFakePosts, hideSuspiciousPosts }) => {
                hideMatchedPosts(status, hideFakePosts, hideSuspiciousPosts)
              },
            )
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
