import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, User, X, Loader2 } from "lucide-react"
import { fetchBlockedUsers, blockUser, unblockUser, type BlockedUser } from "../utils/api-service"

interface SpamUserProps {
  onNavigateBack: () => void
  uuid: string
}

export default function SpamUser({ onNavigateBack, uuid }: SpamUserProps) {
  const [profileUrl, setProfileUrl] = useState<string>("")
  const [spamUsers, setSpamUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState({ adding: false, removing: null as string | null })
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      if (!uuid) return

      try {
        const users = await fetchBlockedUsers(uuid, "spam")
        setSpamUsers(users)
      } catch (error) {
        console.error("Error fetching spam users:", error)
        setMessage({ text: "Failed to load spam users", type: "error" })
      }
    }

    fetchUsers()
  }, [uuid])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const isValidLinkedInURL = (url: string) => {
    const trimmed = url.trim()
    return /^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[a-zA-Z0-9_-]+/.test(trimmed)
  }

  const handleAddSpamUser = useCallback(async () => {
    const trimmedUrl = profileUrl.trim()

    if (!trimmedUrl) {
      return setMessage({ text: "Please enter a LinkedIn profile URL", type: "error" })
    }

    if (!isValidLinkedInURL(trimmedUrl)) {
      return setMessage({
        text: "Enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/username)",
        type: "error",
      })
    }

    const usernameMatch = trimmedUrl.match(/linkedin\.com\/(in|company)\/([^/?]+)/)
    const extractedUsername = usernameMatch ? usernameMatch[2] : ""

    if (!extractedUsername) {
      return setMessage({ text: "Could not extract username from URL", type: "error" })
    }

    setLoading((prev) => ({ ...prev, adding: true }))

    try {
      await blockUser(uuid, extractedUsername, "spam")

      // Update local state
      setSpamUsers((prev) => [...prev, { userName: extractedUsername, _id: Date.now().toString() }])

      // Update chrome storage
      if (typeof window !== "undefined" && window.chrome?.storage) {
        window.chrome.storage.local.get({ spamUsernames: [] }, ({ spamUsernames = [] }) => {
          const updated = [...new Set([...spamUsernames, extractedUsername])]
          window.chrome.storage.local.set({ spamUsernames: updated }, () => {
            window.chrome.runtime.sendMessage({ action: "RE_EVALUATE_POSTS" })
          })
        })
      }

      setMessage({ text: "User marked as spam successfully", type: "success" })
      setProfileUrl("")
    } catch (error) {
      console.error("Error marking user as spam:", error)
      setMessage({ text: "Failed to mark user as spam", type: "error" })
    } finally {
      setLoading((prev) => ({ ...prev, adding: false }))
    }
  }, [profileUrl, uuid])

  const handleRemoveSpamUser = useCallback(
    async (userName: string) => {
      setLoading((prev) => ({ ...prev, removing: userName }))

      try {
        await unblockUser(uuid, userName, "spam")

        // Update local state
        setSpamUsers((prev) => prev.filter((user) => user.userName !== userName))

        // Update chrome storage
        if (typeof window !== "undefined" && window.chrome?.storage) {
          window.chrome.storage.local.get({ spamUsernames: [] }, ({ spamUsernames = [] }) => {
            const updated = spamUsernames.filter((name: string) => name !== userName)
            window.chrome.storage.local.set({ spamUsernames: updated }, () => {
              window.chrome.runtime.sendMessage({ action: "RE_EVALUATE_POSTS" })
            })
          })
        }

        setMessage({ text: "User removed from spam successfully", type: "success" })
      } catch (error) {
        console.error("Error removing spam user:", error)
        setMessage({ text: "Failed to remove spam user", type: "error" })
      } finally {
        setLoading((prev) => ({ ...prev, removing: null }))
      }
    },
    [uuid],
  )

  return (
    <div className="spam-users-container">
      <div className="Spam-users-header">
        <button className="back-button" onClick={onNavigateBack}>
          <ArrowLeft className="back-icon" />
        </button>
        <h1 className="title">Spam Profile</h1>
      </div>

      <div className="Spam-users-content">
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter LinkedIn profile URL"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            className="text-input"
          />
          <button onClick={handleAddSpamUser} className="spam-button" disabled={loading.adding || !profileUrl}>
            {loading.adding ? <Loader2 className="animate-spin" /> : <span>Spam User</span>}
          </button>
        </div>

        {message && (
          <p className={`message ${message.type === "success" ? "success-message" : "error-message"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="users-list-container">
        <h3 className="list-title">Spam Profiles</h3>
        <div className="users-list">
          {spamUsers.length > 0 ? (
            spamUsers.map((user) => (
              <div key={user._id} className="user-item">
                <div className="user-info">
                  <User className="user-icon" />
                  <div>
                    <span className="user-name">{user.userName}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveSpamUser(user.userName)}
                  className="remove-button"
                  disabled={loading.removing === user.userName}
                >
                  {loading.removing === user.userName ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <X className="remove-icon" />
                  )}
                </button>
              </div>
            ))
          ) : (
            <p className="empty-message">No spam profiles</p>
          )}
        </div>
      </div>
    </div>
  )
}
