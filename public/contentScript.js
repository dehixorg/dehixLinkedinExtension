(() => {
  const API_BASE_URL = "http://localhost:5000/api/users"
  const ICON_ID = "copy-instructions-icon"
  const MENU_ID = "copy-instructions-menu"
  let lastProcessedUrl = location.href

  const extractPostId = (url) => {
    const match = url.match(/activity-(\d+)/)
    return match ? match[1] : null
  }

  const getBlockedPostIds = () => {
    return new Promise((resolve) => {
      chrome.storage.local.get(["reportedPosts", "uuid"], async ({ reportedPosts = [], uuid }) => {
        if (uuid) {
          try {
            const res = await fetch(`${API_BASE_URL}/block-post/${uuid}/${postId}?reportType=spam`)
            const data = await res.json()
            const apiIds = (data?.blockedUsers || []).map((u) => u.postId)
            resolve(new Set([...reportedPosts, ...apiIds]))
          } catch (e) {
            console.warn("Could not fetch from API:", e)
            resolve(new Set(reportedPosts))
          }
        } else {
          resolve(new Set(reportedPosts))
        }
      })
    })
  }

  const getBlockedProfiles = () => {
    return new Promise((resolve) => {
      chrome.storage.local.get(["blockedProfiles", "uuid"], async ({ blockedProfiles = [], uuid }) => {
        if (uuid) {
          try {
            const res = await fetch(`${API_BASE_URL}/block-post/${uuid}/${postId}?reportType=spam`)
            if (!res.ok) {
              console.error("Failed to fetch blocked profiles. Status:", res.status);
              resolve(new Set(blockedProfiles)); // Returning the previously stored blocked profiles
              return;
            }
            const data = await res.json();
            const apiUsernames = (data?.blockedProfiles || []).map((u) => u.profileSlug);
            resolve(new Set([...blockedProfiles, ...apiUsernames]));
          } catch (e) {
            console.warn("Could not fetch blocked profiles:", e);
            resolve(new Set(blockedProfiles));
          }
        } else {
          resolve(new Set(blockedProfiles));
        }
      });
    });
  };
  

  const hideMatchedPosts = async () => {
    // First check if status is enabled
    const { status = false } = await new Promise((resolve) => {
      chrome.storage.local.get(["status"], resolve)
    })

    if (!status) return // Don't hide posts if status is disabled

    const postIdSet = await getBlockedPostIds()
    const posts = document.querySelectorAll("article")

    posts.forEach((post) => {
      const link = post.querySelector('a[href*="/posts/"]')
      if (link) {
        const postId = extractPostId(link.href)
        if (postId && postIdSet.has(postId)) {
          post.style.display = "none"
          post.classList.add("reported-hidden")
          console.log("Post hidden:", postId)
        }
      }
    })
  }

  const hidePostsFromBlockedProfiles = async () => {
    // First check if status is enabled
    const { status = false } = await new Promise((resolve) => {
      chrome.storage.local.get(["status"], resolve)
    })

    if (!status) return // Don't hide posts if status is disabled

    const blockedProfileSet = await getBlockedProfiles()
    const posts = document.querySelectorAll("article")

    posts.forEach((post) => {
      const profileLink = post.querySelector('a[href*="/in/"]')
      if (profileLink) {
        const match = profileLink.href.match(/linkedin\.com\/in\/([^/?]+)/)
        const profileSlug = match ? match[1] : null
        if (profileSlug && blockedProfileSet.has(profileSlug)) {
          post.style.display = "none"
          post.classList.add("profile-hidden")
          console.log("Profile post hidden:", profileSlug)
        }
      }
    })
  }

  const hideChatsFromBlockedUsers = async () => {
    // First check if status is enabled
    const { status = false } = await new Promise((resolve) => {
      chrome.storage.local.get(["status"], resolve)
    })

    if (!status) return // Don't hide chats if status is disabled

    const blockedSet = await getBlockedProfiles()

    const checkAndHideChats = () => {
      const chatContainers = document.querySelectorAll('[data-control-name="conversation_card"]')

      chatContainers.forEach((chat) => {
        const img = chat.querySelector("img[alt]")
        if (img) {
          const altText = img.alt.toLowerCase()

          blockedSet.forEach((slug) => {
            const formattedSlug = slug.replace(/-/g, " ").toLowerCase()
            if (altText.includes(formattedSlug)) {
              chat.style.display = "none"
              chat.classList.add("blocked-chat-hidden")
              console.log("Chat hidden for:", formattedSlug)
            }
          })
        }
      })
    }

    checkAndHideChats()

    // MutationObserver
    const container = document.querySelector("div.msg-conversations-container__conversations-list") || document.body
    const observer = new MutationObserver(() => checkAndHideChats())
    observer.observe(container, { childList: true, subtree: true })

    // Scroll listener
    container.addEventListener("scroll", () => {
      setTimeout(checkAndHideChats, 300)
    })

    setInterval(checkAndHideChats, 5000)
  }

  const hideIndividualChatIfBlocked = async () => {
    // First check if status is enabled
    const { status = false } = await new Promise((resolve) => {
      chrome.storage.local.get(["status"], resolve)
    })

    if (!status) return // Don't hide chats if status is disabled

    const blockedProfileSet = await getBlockedProfiles()

    const checkAndHide = () => {
      const nameElement =
        document.querySelector('h2[class*="msg-thread__thread-title"]') ||
        document.querySelector("span.msg-thread__participant-names")

      if (nameElement) {
        const name = nameElement.textContent.trim().toLowerCase()
        blockedProfileSet.forEach((slug) => {
          const formattedSlug = slug.replace(/-/g, " ").toLowerCase()
          if (name.includes(formattedSlug)) {
            const chatContainer = document.querySelector('[class*="msg-s-message-list"]')?.parentElement
            if (chatContainer) {
              chatContainer.style.display = "none"
            }
          }
        })
      }
    }

    checkAndHide()

    const observer = new MutationObserver(() => checkAndHide())
    observer.observe(document.body, { childList: true, subtree: true })

    const chatScrollContainer = document.querySelector('[class*="msg-s-message-list"]')
    if (chatScrollContainer) {
      chatScrollContainer.addEventListener("scroll", () => {
        setTimeout(() => checkAndHide(), 200)
      })
    }

    setInterval(() => checkAndHide(), 3000)
  }

  const startPostObserver = () => {
    const feed = document.querySelector(".scaffold-finite-scroll__content") || document.body
    if (!feed) return

    const observer = new MutationObserver(() => {
      hideMatchedPosts()
      hidePostsFromBlockedProfiles()
      hideIndividualChatIfBlocked()
      hideChatsFromBlockedUsers()
    })

    observer.observe(feed, { childList: true, subtree: true })

    hideMatchedPosts()
    hidePostsFromBlockedProfiles()
    hideIndividualChatIfBlocked()
    hideChatsFromBlockedUsers()
  }

  const watchUrlChange = () => {
    setInterval(() => {
      const currentUrl = location.href
      if (currentUrl !== lastProcessedUrl) {
        lastProcessedUrl = currentUrl
        hideMatchedPosts()
        hidePostsFromBlockedProfiles()
        hideIndividualChatIfBlocked()
        hideChatsFromBlockedUsers()
      }
    }, 1000)
  }

  const addFloatingIcon = () => {
    if (document.getElementById(ICON_ID)) return

    chrome.storage.local.get(["statusEnabled", "hideInstructions"], ({ statusEnabled, hideInstructions }) => {
      if (!statusEnabled || hideInstructions) {
        removeFloatingIcon()
        return
      }

      const icon = document.createElement("div")
      icon.id = ICON_ID
      icon.innerText = "ℹ️"
      Object.assign(icon.style, {
        position: "fixed",
        left: "10px",
        top: "50%",
        transform: "translateY(-50%)",
        backgroundColor: "#0073b1",
        color: "white",
        padding: "10px",
        borderRadius: "50%",
        cursor: "pointer",
        fontSize: "16px",
        zIndex: "1000",
        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)",
      })

      icon.addEventListener("click", toggleMenu)
      document.body.appendChild(icon)
    })
  }

  const removeFloatingIcon = () => {
    document.getElementById(ICON_ID)?.remove()
  }

  const toggleMenu = () => {
    const existing = document.getElementById(MENU_ID)
    if (existing) {
      existing.remove()
      return
    }

    const menu = document.createElement("div")
    menu.id = MENU_ID
    menu.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;font-size:14px;padding:15px;">
        <strong style="font-size:16px;color:#333;">How to Block a Post:</strong>
        <ol style="margin:15px 0;padding-left:0;text-align:left;list-style:none;">
          <li>1) Click the three dots on the post.</li>
          <li>2) Copy the post link from the menu.</li>
          <li>3) Open the extension and select "Report Post".</li>
          <li>4) Paste the link and click "Block".</li>
        </ol>
        <button id="hide-instructions-btn" style="background:#d9534f;color:white;padding:8px 15px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Don't Show Again</button>
      </div>
    `

    Object.assign(menu.style, {
      position: "fixed",
      left: "50px",
      top: "50%",
      transform: "translateY(-50%)",
      backgroundColor: "#fff",
      color: "#333",
      padding: "20px",
      borderRadius: "12px",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
      zIndex: "1001",
      maxWidth: "280px",
      fontFamily: "Arial, sans-serif",
    })

    document.body.appendChild(menu)

    document.getElementById("hide-instructions-btn")?.addEventListener("click", () => {
      chrome.storage.local.set({ hideInstructions: true }, () => {
        menu.remove()
        removeFloatingIcon()
      })
    })
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "CHECK_AND_BLOCK_POST" && message.postUrl) {
      const postId = extractPostId(message.postUrl)
      if (!postId) {
        sendResponse({ success: false, reason: "Invalid URL" })
        return
      }

      chrome.storage.local.get(["reportedPosts"], ({ reportedPosts = [] }) => {
        // Add the post ID to the reported posts list
        const updatedPosts = [...new Set([...reportedPosts, postId])]

        chrome.storage.local.set({ reportedPosts: updatedPosts }, () => {
          // Now try to find and hide the post on the current page
          const posts = document.querySelectorAll("article")
          let foundMatch = false

          posts.forEach((post) => {
            const link = post.querySelector('a[href*="/posts/"]')
            if (link && extractPostId(link.href) === postId) {
              foundMatch = true
              post.style.display = "none"
              post.classList.add("reported-hidden")
              console.log("Post blocked:", postId)
            }
          })

          setTimeout(() => {
            sendResponse({
              success: true,
              reason: foundMatch ? "Post blocked and hidden" : "Post blocked but not found on current page",
            })
          }, 500)
        })
      })

      return true // Keep the message channel open for the async response
    }

    if (message.action === "RE_EVALUATE_POSTS") {
      hideMatchedPosts()
      hidePostsFromBlockedProfiles()
      hideIndividualChatIfBlocked()
      hideChatsFromBlockedUsers()
    }

    if (message.action === "SETTINGS_UPDATED" && message.setting === "status") {
      // If status setting was updated, re-evaluate all posts
      if (message.value) {
        // If status was turned on, hide posts
        hideMatchedPosts()
        hidePostsFromBlockedProfiles()
        hideIndividualChatIfBlocked()
        hideChatsFromBlockedUsers()
      }
      // If status was turned off, we don't need to do anything as posts will remain visible
    }
  })

  // Fix: Declare chrome if it's not already defined (e.g., when testing outside a Chrome extension environment)
  if (typeof chrome === "undefined") {
    console.warn("Chrome API not available.  This script is designed to run within a Chrome extension.")
    return // Or provide a mock implementation if needed for testing.
  }

  window.addEventListener("load", () => {
    try {
      startPostObserver()
      watchUrlChange()
      addFloatingIcon()
      hideMatchedPosts()
      hidePostsFromBlockedProfiles()
      hideIndividualChatIfBlocked()
      hideChatsFromBlockedUsers()

      setInterval(() => {
        hideMatchedPosts()
        hidePostsFromBlockedProfiles()
        hideIndividualChatIfBlocked()
        hideChatsFromBlockedUsers()
      }, 5000)
    } catch (e) {
      console.error("Initialization failed:", e)
    }
  })
})()
