import { useState, useEffect } from "react"
import { ChevronDown, AlertTriangle, Shield, Activity, ExternalLink } from "lucide-react"
import "./style.css"
import { fetchBlockedUsers, fetchBlockedPosts, type BlockedUser, type BlockedPost } from "../utils/api-service"

interface FraudDetectionProps {
  onNavigateToBlockedUsers: () => void
  onNavigateToBlockedProfiles: () => void
  onNavigateToSpamPosts: () => void
  onNavigateToSpamUser: () => void
  onNavigateToActivityLogs: () => void
}

export default function FraudDetection({
  onNavigateToBlockedUsers,
  onNavigateToBlockedProfiles,
  onNavigateToSpamPosts,
  onNavigateToSpamUser,
  onNavigateToActivityLogs,
}: FraudDetectionProps) {
  const [status, setStatus] = useState<boolean>(false)
  const [hideFakePosts, setHideFakePosts] = useState<boolean>(false)
  const [hideSuspiciousPosts, setHideSuspiciousPosts] = useState<boolean>(false)
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(true)
  const [_, setEnabled] = useState(true)
  const [uuid, setUuid] = useState<string>("")
  const [, setBlockedUsers] = useState<BlockedUser[]>([])
  const [, setBlockedPosts] = useState<BlockedPost[]>([])
  const [, setSpamPosts] = useState<BlockedPost[]>([])
  const [, setSpamUsers] = useState<BlockedUser[]>([])

  // Fetch data from API and update storage
  const fetchAndUpdateData = async () => {
    if (!uuid) return

    try {
      // Fetch suspicious users
      const suspiciousUsers = await fetchBlockedUsers(uuid, "suspicious")
      // Fetch spam users
      const spamUsersList = await fetchBlockedUsers(uuid, "spam")
      // Fetch not useful posts
      const notUsefulPosts = await fetchBlockedPosts(uuid, "notUseful")
      // Fetch spam posts
      const spamPostsList = await fetchBlockedPosts(uuid, "spam")

      setBlockedUsers(suspiciousUsers)
      setSpamUsers(spamUsersList)
      setBlockedPosts(notUsefulPosts)
      setSpamPosts(spamPostsList)

      // Update chrome storage with the fetched data
      if (typeof window !== "undefined" && window.chrome?.storage) {
        const reportedUsernames = suspiciousUsers.map((user:any) => user.userName)
        const spamUsernames = spamUsersList.map((user:any) => user.userName)
        const reportedPosts = notUsefulPosts.map((post:any) => post.postId)
        const spamPostIds = spamPostsList.map((post:any) => post.postId)

        window.chrome.storage.local.set(
          {
            reportedUsernames,
            spamUsernames,
            reportedPosts,
            spamPosts: spamPostIds,
          },
          () => {
            // Notify content script to re-evaluate posts with new data
            window.chrome.runtime?.sendMessage({
              action: "RE_EVALUATE_POSTS",
            })
          },
        )
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && window.chrome?.storage) {
      window.chrome.storage.local.get(
        ["status", "hideFakePosts", "hideSuspiciousPosts", "advancedOpen", "uuid"],
        (data: any) => {
          if (data.status !== undefined) setStatus(data.status)
          else {
            setStatus(true)
            window.chrome.storage.local.set({ status: true })
          }
          if (data.hideFakePosts !== undefined) setHideFakePosts(data.hideFakePosts)
          if (data.hideSuspiciousPosts !== undefined) setHideSuspiciousPosts(data.hideSuspiciousPosts)
          if (data.advancedOpen !== undefined) setAdvancedOpen(data.advancedOpen)
          else {
            setAdvancedOpen(true)
            window.chrome.storage.local.set({ advancedOpen: true })
          }
          if (data.uuid) {
            setUuid(data.uuid)
          }
        },
      )
      window.chrome.storage.local.get(["statusEnabled"], (data) => {
        setEnabled(data.statusEnabled ?? true)
      })
    }
  }, [])

  // Fetch data when uuid changes
  useEffect(() => {
    if (uuid) {
      fetchAndUpdateData()
    }
  }, [uuid])

  const handleLogoClick = () => {
    const newStatus = !status

    setStatus(newStatus)

    if (typeof window !== "undefined" && window.chrome?.storage) {
      window.chrome.storage.local.set({ status: newStatus }, () => {
        window.chrome.runtime?.sendMessage({
          action: "SETTINGS_UPDATED",
          setting: "status",
          value: newStatus,
        })
      })
    }
  }

  const [toggleCounts, setToggleCounts] = useState<Record<string, number[]>>({
    status: [],
    hideFakePosts: [],
    hideSuspiciousPosts: [],
  })

  const isRateLimited = (setting: string): boolean => {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    const recentToggles = toggleCounts[setting]?.filter((t) => t > oneMinuteAgo) || []
    return recentToggles.length >= 10
  }

  const handleToggle = (setting: string, value: boolean) => {
    if (isRateLimited(setting)) {
      alert(`You're toggling too frequently. Please wait a moment before toggling again.`)
      return
    }

    const now = Date.now()
    setToggleCounts((prev) => ({
      ...prev,
      [setting]: [...(prev[setting] || []), now],
    }))

    switch (setting) {
      case "status":
        setStatus(value)
        break
      case "hideFakePosts":
        setHideFakePosts(value)
        break
      case "hideSuspiciousPosts":
        setHideSuspiciousPosts(value)
        break
    }

    if (typeof window !== "undefined" && window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({
        action: "SETTINGS_UPDATED",
        setting,
        value,
      })
    }

    if (typeof window !== "undefined" && window.chrome?.storage) {
      window.chrome.storage.local.set({ [setting]: value })
    }
  }

  return (
    <div className="fraud-detection-container">
      <div className={`logo-section ${status ? "logo-active" : "logo-inactive"}`}>
        <div className="logo">
          <img src="/main-logo.png" alt="Dehix Logo" className="logo-icon" onClick={handleLogoClick} />
        </div>
      </div>

      <div className="content-section">
        <h1 className="title">Dehix Fraud Detector</h1>

        <div className="settings-card">
          <div className="toggle-list">
            <div className="toggle-item">
              <div className="toggle-label">
                <Activity className="toggle-icon status-icon" size={18} />
                <span>Status</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={status} onChange={(e) => handleToggle("status", e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-label">
                <Shield className="toggle-icon shield-icon" size={18} />
                <span>Hide fake posts</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hideFakePosts}
                  onChange={(e) => handleToggle("hideFakePosts", e.target.checked)}
                  disabled={!status}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-label">
                <AlertTriangle className="toggle-icon alert-icon" size={18} />
                <span className="toggle-text">Hide suspicious posts</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hideSuspiciousPosts}
                  onChange={(e) => handleToggle("hideSuspiciousPosts", e.target.checked)}
                  disabled={!status}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="button-group">
          <button className="action-button" disabled={!status}>
            <div className="button-content" onClick={onNavigateToActivityLogs}>
              <Activity size={16} className="button-icon" />
              <span>activity</span>
            </div>
          </button>
          <button className="action-button">
            <div className="button-content">
              <ExternalLink size={16} className="button-icon" />
              <span>Dehix</span>
            </div>
          </button>
        </div>

        <div className="custom-accordion">
          <div
            className="accordion-header"
            onClick={() => {
              const newVal = !advancedOpen
              setAdvancedOpen(newVal)
              if (typeof window !== "undefined" && window.chrome?.storage) {
                window.chrome.storage.local.set({ advancedOpen: newVal })
              }
            }}
          >
            <div className="accordion-title">
              <span>Advanced Settings</span>
            </div>
            <ChevronDown className={`chevron-icon ${advancedOpen ? "rotate" : ""}`} size={16} />
          </div>
          {advancedOpen && (
            <div className="accordion-content">
              <div className="advanced-options">
                <button className="advanced-option-button block-button-red" onClick={onNavigateToBlockedUsers}>
                  <span>Block Post</span>
                </button>
                <button className="advanced-option-button block-button-red" onClick={onNavigateToBlockedProfiles}>
                  <span>Block User</span>
                </button>
                <button
                  className="advanced-option-button block-button-red"
                  onClick={onNavigateToSpamPosts}
                  disabled={!status}
                >
                  <span>Spam Post</span>
                </button>
                <button
                  className="advanced-option-button block-button-red"
                  onClick={onNavigateToSpamUser}
                  disabled={!status}
                >
                  <span>Spam User</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
