// API service to centralize all API calls
const API_BASE_URL = "http://localhost:5000/api/users"

// Types for API responses
export interface BlockedUser {
  userName: string
  _id: string
}

export interface BlockedPost {
  postId: string
  userName: string
  _id: string
}

// Fetch blocked users (suspicious or spam)
export const fetchBlockedUsers = async (uuid: string, blockType: "suspicious" | "spam" | "all" = "all") => {
  try {
    const response = await fetch(`${API_BASE_URL}/blocked-users/${uuid}?blockType=${blockType}`)
    const data = await response.json()
    return data.blockedUsers || []
  } catch (error) {
    console.error("Error fetching blocked users:", error)
    return []
  }
}

// Fetch blocked posts (spam or not useful)
export const fetchBlockedPosts = async (uuid: string, reportType: "spam" | "notUseful" | "all" = "all") => {
  try {
    const response = await fetch(`${API_BASE_URL}/blocked-posts/${uuid}?reportType=${reportType}`)
    const data = await response.json()
    return data.blockedUsers || []
  } catch (error) {
    console.error("Error fetching blocked posts:", error)
    return []
  }
}

// Block a user
export const blockUser = async (uuid: string, targetUserName: string, blockType: "suspicious" | "spam") => {
  try {
    const response = await fetch(`${API_BASE_URL}/block-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid,
        targetUserName,
        blockType,
      }),
    })
    return await response.json()
  } catch (error) {
    console.error("Error blocking user:", error)
    throw error
  }
}

// Block a post
export const blockPost = async (
  uuid: string,
  postId: string,
  userName: string,
  postUrl: string,
  reportType: "spam" | "notUseful",
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/block-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid,
        postId,
        userName,
        postUrl,
        reportType,
      }),
    })
    return await response.json()
  } catch (error) {
    console.error("Error blocking post:", error)
    throw error
  }
}

// Unblock a user
export const unblockUser = async (uuid: string, userName: string, blockType: "suspicious" | "spam") => {
  try {
    const response = await fetch(`${API_BASE_URL}/block-user/${uuid}/${userName}?blockType=${blockType}`, {
      method: "DELETE",
    })
    return await response.json()
  } catch (error) {
    console.error("Error unblocking user:", error)
    throw error
  }
}

// Unblock a post
export const unblockPost = async (uuid: string, postId: string, reportType: "spam" | "notUseful") => {
  try {
    const response = await fetch(`${API_BASE_URL}/block-post/${uuid}/${postId}?reportType=${reportType}`, {
      method: "DELETE",
    })
    return await response.json()
  } catch (error) {
    console.error("Error unblocking post:", error)
    throw error
  }
}
