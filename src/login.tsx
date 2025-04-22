import { useState } from "react"
import "./style.css"

export default function LoginContainer({ setShowLoginSignup }: any) {
    const [isHovered, setIsHovered] = useState<string | null>(null)

    const handleSkip = () => {
        chrome.storage.local.set({ hasSeenLoginSignup: true });
        setShowLoginSignup(false);
    };

    const handleLogin = () => {
        chrome.storage.local.set({ hasSeenLoginSignup: true });
        setShowLoginSignup(false);
    };

    return (
        <div className="extension-container">
            <div className="login-container">
                <div className="logo-section">
                    <img src="/main-logo.png" className="logo" alt="Dehix Logo" />
                </div>
                <h2 className="title">Dehix Fraud Detector</h2>

                <div className="action-buttons">
                    <button
                        className={`action-btn ${isHovered === "login" ? "hovered" : ""}`}
                        onClick={handleLogin}
                        onMouseEnter={() => setIsHovered("login")}
                        onMouseLeave={() => setIsHovered(null)}
                    >
                        Login
                    </button>
                    <button
                        className={`action-btn ${isHovered === "signup" ? "hovered" : ""}`}
                        onClick={handleLogin}
                        onMouseEnter={() => setIsHovered("signup")}
                        onMouseLeave={() => setIsHovered(null)}
                    >
                        Signup
                    </button>
                <button
                    className="skip-btn"
                    onClick={handleSkip}
                >
                    Skip
                </button>
                </div>
            </div>
        </div>
    )
}
