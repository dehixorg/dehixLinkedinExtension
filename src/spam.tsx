import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, User, X, Loader2 } from "lucide-react"
import { fetchBlockedPosts, blockPost, unblockPost, type BlockedPost } from "../utils/api-service"

interface SpamPostsProps {
  onNavigateBack: () => void
  uuid: string
}

export default function SpamPosts({ onNavigateBack, uuid }: SpamPostsProps) {
  const [postUrl, setPostUrl] = useState<string>("")
  const [spamPosts, setSpamPosts] = useState<BlockedPost[]>([])
  const [loading, setLoading] = useState({ adding: false, removing: null as string | null })
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    const fetchPosts = async () => {
      if (!uuid) return

      try {
        const posts = await fetchBlockedPosts(uuid, "spam")
        setSpamPosts(posts)
      } catch (error) {
        console.error("Error fetching spam posts:", error)
        setMessage({ text: "Failed to load spam posts", type: "error" })
      }
    }

    fetchPosts()
  }, [uuid])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const handleAddSpamPost = useCallback(async () => {
    if (!postUrl.trim()) {
      return setMessage({ text: "Please enter a post URL", type: "error" })
    }

    const postIdMatch = postUrl.match(/activity-(\d+)-/)
    const postId = postIdMatch ? postIdMatch[1] : null

    const userMatch = postUrl.match(/linkedin\.com\/posts\/([^_]+)/)
    const extractedUserName = userMatch ? userMatch[1] : null

    if (!postId || !extractedUserName) {
      return setMessage({ text: "Invalid LinkedIn post URL", type: "error" })
    }

    setLoading((prev) => ({ ...prev, adding: true }))

    try {
      const data = await blockPost(uuid, postId, extractedUserName, postUrl, "spam")

      // Update local state
      setSpamPosts((prev) => [...prev, { postId, userName: extractedUserName, _id: data.reportId }])

      // Update chrome storage
      if (typeof window !== "undefined" && window.chrome?.storage) {
        window.chrome.storage.local.get({ spamPosts: [] }, ({ spamPosts = [] }) => {
          const updated = [...new Set([...spamPosts, postId])]
          window.chrome.storage.local.set({ spamPosts: updated }, () => {
            window.chrome.runtime.sendMessage({ action: "RE_EVALUATE_POSTS" })
          })
        })
      }

      setMessage({ text: "Post marked as spam successfully", type: "success" })
      setPostUrl("")
    } catch (error) {
      console.error("Error marking post as spam:", error)
      setMessage({ text: "Failed to mark post as spam", type: "error" })
    } finally {
      setLoading((prev) => ({ ...prev, adding: false }))
    }
  }, [postUrl, uuid])

  const handleRemoveSpamPost = useCallback(
    async (postId: string) => {
      setLoading((prev) => ({ ...prev, removing: postId }))

      try {
        await unblockPost(uuid, postId, "spam")

        // Update local state
        setSpamPosts((prev) => prev.filter((post) => post.postId !== postId))

        // Update chrome storage
        if (typeof window !== "undefined" && window.chrome?.storage) {
          window.chrome.storage.local.get({ spamPosts: [] }, ({ spamPosts = [] }) => {
            const updated = spamPosts.filter((id: string) => id !== postId)
            window.chrome.storage.local.set({ spamPosts: updated }, () => {
              window.chrome.runtime.sendMessage({ action: "RE_EVALUATE_POSTS" })
            })
          })
        }

        setMessage({ text: "Post removed from spam successfully", type: "success" })
      } catch (error) {
        console.error("Error removing spam post:", error)
        setMessage({ text: "Failed to remove spam post", type: "error" })
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
        <h1 className="title">Spam Posts</h1>
      </div>

      <div className="Spam-users-content">
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter post link to mark as spam"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            className="text-input"
          />
          <button onClick={handleAddSpamPost} className="spam-button" disabled={loading.adding || !postUrl}>
            {loading.adding ? <Loader2 className="animate-spin" /> : <span>Spam Post</span>}
          </button>
        </div>

        {message && (
          <p className={`message ${message.type === "success" ? "success-message" : "error-message"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="users-list-container">
        <h3 className="list-title">Spam Posts</h3>
        <div className="users-list">
          {spamPosts.length > 0 ? (
            spamPosts.map((post) => (
              <div key={post._id} className="user-item">
                <div className="user-info">
                  <User className="user-icon" />
                  <div>
                    <span className="user-name">{post.userName}</span>
                    <p className="post-id">{post.postId}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveSpamPost(post.postId)}
                  className="remove-button"
                  disabled={loading.removing === post.postId}
                >
                  {loading.removing === post.postId ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <X className="remove-icon" />
                  )}
                </button>
              </div>
            ))
          ) : (
            <p className="empty-message">No spam posts</p>
          )}
        </div>
      </div>
    </div>
  )
}
