import { useState} from "react"
import { ArrowLeft } from "lucide-react"

interface SpamPostsProps {
    onNavigateBack: () => void
    uuid: string
}

export default function SpamPosts({ onNavigateBack}: SpamPostsProps) {

    const [username, setUsername] = useState<string>("")

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
                        placeholder="Enter post link to Spam"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="text-input"
                    />
                    <button  className="spam-button">
                        <span>Spam Post</span>
                    </button>
                </div>
            </div>

            <div className="users-list-container">
                <h3 className="list-title">Spam Posts</h3>
                <div className="users-list">
                    <p className="empty-message">No spam posts</p>
                </div>
              
            </div>

        </div>
    )


}
