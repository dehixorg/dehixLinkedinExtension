import { useState, useEffect } from "react"
import FraudDetection from "./fraud"
import BlockedPosts from "./block"
import SpamPosts from "./spam"
import BlockedProfiles from "./block-profile"
import SpamUser from "./spamuser"
import "./style.css"
import LoginContainer from "./login"

// Declare chrome if it's not available in the current environment (e.g., testing)


type PageType = "fraud-detection" | "blocked-posts" | "blocked-profiles" | "spam-posts" | "spam-user"

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageType>("fraud-detection")
  const [showLoginSignup, setShowLoginSignup] = useState<boolean>(false)
  const [uuid, setUuid] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && window.chrome && window.chrome.storage) {
      window.chrome.storage.local.get(["hasSeenLoginSignup"], (data) => {
        setShowLoginSignup(data.hasSeenLoginSignup === false)
      })

      window.chrome.storage.local.get(["uuid"], (data) => {
        if (data.uuid) {
          setUuid(data.uuid)
        }
      })
    }
  }, [])

  return (
    <main className="app-container">
      <div className="app-card">
        {showLoginSignup ? (
          <LoginContainer setShowLoginSignup={setShowLoginSignup} />
        ) : currentPage === "fraud-detection" ? (
          <FraudDetection
            onNavigateToBlockedUsers={() => setCurrentPage("blocked-posts")}
            onNavigateToBlockedProfiles={() => setCurrentPage("blocked-profiles")}
            onNavigateToSpamPosts={() => setCurrentPage("spam-posts")}
            onNavigateToSpamUser={() => setCurrentPage("spam-user")}
          />
        ) : currentPage === "spam-posts" ? (
          <SpamPosts onNavigateBack={() => setCurrentPage("fraud-detection")} uuid={uuid || ""} />
        ) : currentPage === "spam-user" ? (
          <SpamUser onNavigateBack={() => setCurrentPage("fraud-detection")} uuid={uuid || ""} />
        ) : currentPage === "blocked-posts" ? (
          <BlockedPosts onNavigateBack={() => setCurrentPage("fraud-detection")} uuid={uuid || ""} />
        ) : (
          <BlockedProfiles onNavigateBack={() => setCurrentPage("fraud-detection")} uuid={uuid || ""} />
        )}
      </div>
    </main>
  )
}
