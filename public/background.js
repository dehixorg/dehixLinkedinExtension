const API_BASE_URL = "http://localhost:5000/api/users";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["uuid", "hasSeenLoginSignup", "statusEnabled"], async (data) => {
    if (!data.uuid) {
      try {
        const { ip } = await fetch("https://api64.ipify.org?format=json").then(res => res.json());
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userAgent: navigator.userAgent, ip }),
        }).then(res => res.json());

        chrome.storage.local.set({
          uuid: response.uuid,
          hasSeenLoginSignup: false,
          statusEnabled: true,
        });

        console.log("UUID Stored:", response.uuid);
      } catch (error) {
        //console.error("User registration failed:", error);
      }
    } else if (data.statusEnabled === undefined) {
      chrome.storage.local.set({ statusEnabled: true });
      console.log("Initial status set to true.");
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "BLOCK_USER") {
    blockUser(message, sendResponse);
    return true;
  }

  if (message.action === "TOGGLE_STATUS") {
    toggleStatus(message);
  }
  if (message.action === "reportPost") {
    chrome.storage.local.get({ reportedPosts: [] }, function (data) {
      const updatedPosts = [...new Set([...data.reportedPosts, message.postId])]; 
      chrome.storage.local.set({ reportedPosts: updatedPosts }, function () {
        sendResponse({ status: "success" });
      });
    });
    return true; 
  }
});

const blockUser = async ({ uuid, username }, sendResponse) => {
  try {
    const response = await fetch(`${API_BASE_URL}/block-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid, username }),
    });

    const result = await response.json();
    sendResponse(result);
  } catch (err) {
    console.error("Error blocking user:", err);
    sendResponse({ error: true });
  }
};

const toggleStatus = (message) => {
  chrome.storage.local.set({ statusEnabled: message.statusEnabled }, () => {
    console.log("Status updated to:", message.statusEnabled);
  });
};