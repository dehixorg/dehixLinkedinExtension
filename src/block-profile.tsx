import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, User, X, Loader2 } from "lucide-react"
import { blockUser, fetchBlockedUsers, unblockUser } from "../utils/api-service"

interface BlockedProfilesProps {
  onNavigateBack: () => void
  uuid: string
}

interface BlockedProfile {
  userName: string
  _id: string
}

export default function BlockedProfiles({ onNavigateBack, uuid }: BlockedProfilesProps) {
  const [username, setUsername] = useState<string>("")
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfile[]>([])
  const [loading, setLoading] = useState<{
    blocking: boolean
    unblocking: string | null
  }>({
    blocking: false,
    unblocking: null,
  })
  const [message, setMessage] = useState<{
    text: string
    type: "success" | "error"
  } | null>(null)

  useEffect(() => {
    const fetchBlockedProfiles = async () => {
      try {
        const users = await fetchBlockedUsers(uuid, "suspicious")
        setBlockedProfiles(users || [])
      } catch (error) {
        setMessage({ text: "Failed to load blocked profiles.", type: "error" })
      }
    }

    if (uuid) {
      fetchBlockedProfiles()
    }
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


  const handleBlockProfile = useCallback(async () => {
    const trimmedUsername = username.trim()

    if (!trimmedUsername) {
      return setMessage({ text: "Please enter a LinkedIn profile URL.", type: "error" })
    }

    if (!isValidLinkedInURL(trimmedUsername)) {
      return setMessage({
        text: "Enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/username or /company/companyname)",
        type: "error",
      })
    }

    const usernameMatch = trimmedUsername.match(/linkedin\.com\/(in|company)\/([^\/?]+)/)
    const extractedUsername = usernameMatch ? usernameMatch[2] : ""

    if (!extractedUsername) {
      return setMessage({ text: "Could not extract username from URL.", type: "error" })
    }


    if (!extractedUsername) {
      return setMessage({ text: "Could not extract username from URL.", type: "error" })
    }

    setLoading((prev) => ({ ...prev, blocking: true }))

    try {
      await blockUser(uuid, extractedUsername, "suspicious")

      setBlockedProfiles((prev) => [...prev, { userName: extractedUsername, _id: Date.now().toString() }])
      // after successful API call
      chrome.storage.local.get(["reportedUsernames"], ({ reportedUsernames = [] }) => {
        const updatedUsernames = [...reportedUsernames, extractedUsername]
        chrome.storage.local.set({ reportedUsernames: updatedUsernames })
      })

      setMessage({ text: "User marked as block successfully", type: "success" })
      setUsername("")
    } catch (error: any) {
      setMessage({
        text: error.response?.data?.error || "Failed to block profile.",
        type: "error",
      })
    } finally {
      setLoading((prev) => ({ ...prev, blocking: false }))
    }
  }, [username, uuid])


  const handleRemoveProfile = useCallback(
    async (userName: string) => {
      setLoading((prev) => ({ ...prev, unblocking: userName }))

      try {
        await unblockUser(uuid, userName, "suspicious")

        setBlockedProfiles((prev) => prev.filter((profile) => profile.userName !== userName))
        setMessage({ text: "Profile unblocked successfully.", type: "success" })
      } catch (error: any) {
        setMessage({
          text: error.response?.data?.error || "Failed to unblock profile.",
          type: "error",
        })
      } finally {
        setLoading((prev) => ({ ...prev, unblocking: null }))
      }
    },
    [uuid],
  )

  return (
    <div className="blocked-users-container">
      <div className="blocked-users-header">
        <button className="back-button" onClick={onNavigateBack}>
          <ArrowLeft className="back-icon" />
        </button>
        <h1 className="title">Blocked Profiles</h1>
      </div>

      <div className="blocked-users-content">
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter LinkedIn profile URL"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="text-input"
          />
          <button onClick={handleBlockProfile} className="block-button" disabled={loading.blocking || !username}>
            {loading.blocking ? <Loader2 className="animate-spin" /> : "Block"}
          </button>
        </div>

        {message && (
          <p className={`message ${message.type === "success" ? "success-message" : "error-message"}`}>
            {message.text}
          </p>
        )}

        <div className="users-list-container">
          <h3 className="list-title">Blocked Profiles</h3>
          <div className="users-list">
            {blockedProfiles.length > 0 ? (
              blockedProfiles.map((profile) => (
                <div key={profile._id} className="user-item">
                  <div className="user-info">
                    <User className="user-icon" />
                    <div>
                      <span className="user-name">{profile.userName.substring(0, 10)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveProfile(profile.userName)}
                    className="remove-button"
                    disabled={loading.unblocking === profile.userName}
                  >
                    {loading.unblocking === profile.userName ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <X className="remove-icon" />
                    )}
                  </button>
                </div>
              ))
            ) : (
              <p className="empty-message">No blocked profiles</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
