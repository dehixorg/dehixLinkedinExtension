"use client"

import { useState, useEffect } from "react"
import { ChevronDown, AlertTriangle, Shield, Activity, ExternalLink } from "lucide-react"
import "./style.css"

interface FraudDetectionProps {
  onNavigateToBlockedUsers: () => void
  onNavigateToBlockedProfiles: () => void
  onNavigateToActivityLogs: () => void
}

export default function FraudDetection({
  onNavigateToBlockedUsers,
  onNavigateToBlockedProfiles,
  onNavigateToActivityLogs,
}: FraudDetectionProps) {
  const [status, setStatus] = useState<boolean>(false)
  const [hideFakePosts, setHideFakePosts] = useState<boolean>(false)
  const [hideSuspiciousPosts, setHideSuspiciousPosts] = useState<boolean>(false)
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false)

  // Rate limiting state
  const [toggleCounts, setToggleCounts] = useState<Record<string, number[]>>({
    status: [],
    hideFakePosts: [],
    hideSuspiciousPosts: [],
  })

  useEffect(() => {
    // Load saved settings from chrome storage or set default values
    if (typeof window !== "undefined" && window.chrome && window.chrome.storage) {
      window.chrome.storage.local.get(["status", "hideFakePosts", "hideSuspiciousPosts"], (data: any) => {
        if (data.status !== undefined) setStatus(data.status)
        else {
          setStatus(true) // Set to true by default on first install
          window.chrome.storage.local.set({ status: true }) // Save default state to storage
        }
        if (data.hideFakePosts !== undefined) setHideFakePosts(data.hideFakePosts)
        if (data.hideSuspiciousPosts !== undefined) setHideSuspiciousPosts(data.hideSuspiciousPosts)
      })
    }
  }, [])

  // Check if toggle is rate limited (more than 10 times in a minute)
  const isRateLimited = (setting: string): boolean => {
    const now = Date.now()
    const oneMinuteAgo = now - 60000 // 1 minute in milliseconds

    // Filter timestamps from the last minute
    const recentToggles = toggleCounts[setting]?.filter((timestamp) => timestamp > oneMinuteAgo) || []

    // Rate limited if 10 or more toggles in the last minute
    return recentToggles.length >= 10
  }

  const handleToggle = (setting: string, value: boolean) => {
    // Check for rate limiting
    if (isRateLimited(setting)) {
      alert(`You're toggling too frequently. Please wait a moment before toggling again.`)
      return
    }

    // Update toggle count for rate limiting
    const now = Date.now()
    setToggleCounts((prev) => ({
      ...prev,
      [setting]: [...(prev[setting] || []), now],
    }))

    // Update state based on setting
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
      default:
        break
    }

    // Send the change to the background script immediately
    if (typeof window !== "undefined" && window.chrome && window.chrome.runtime) {
      window.chrome.runtime.sendMessage({
        action: "SETTINGS_UPDATED",
        setting,
        value,
      })
    }

    // Save the state change in chrome storage
    if (typeof window !== "undefined" && window.chrome && window.chrome.storage) {
      window.chrome.storage.local.set({ [setting]: value })
    }
  }

  return (
    <div className="fraud-detection-container">
      <div className={`logo-section ${status ? "logo-active" : "logo-inactive"}`}>
        <div className="logo">
          <img src="/main-logo.png" alt="Dehix Logo" className="logo-icon" />
        </div>
      </div>

      <div className="content-section">
        <h1 className="title">Dehix Fraud Detector</h1>

        {/* Main Settings */}
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

        {/* Action Buttons */}
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

        {/* Advanced Settings Accordion */}
        <div className="custom-accordion">
          <div className="accordion-header" onClick={() => setAdvancedOpen(!advancedOpen)}>
            <div className="accordion-title">
              <span>Advanced Settings</span>
            </div>
            <ChevronDown className={`chevron-icon ${advancedOpen ? "rotate" : ""}`} size={16} />
          </div>
          {advancedOpen && (
            <div className="accordion-content">
              <div className="advanced-options">
                {/* Block buttons are enabled regardless of status */}
                <button className="advanced-option-button block-button-red" onClick={onNavigateToBlockedUsers}>
                  <span>Block Post</span>
                </button>
                <button className="advanced-option-button block-button-red" onClick={onNavigateToBlockedProfiles}>
                  <span>Block User</span>
                </button>
                <button className="advanced-option-button spam-button-gray" disabled={!status}>
                  <span>Spam Post</span>
                </button>
                <button className="advanced-option-button spam-button-gray" disabled={!status}>
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
