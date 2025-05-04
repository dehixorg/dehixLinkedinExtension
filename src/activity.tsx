import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  LogIn,
  ShieldAlert,
  UserPlus,
  Link as LinkIcon,
} from "lucide-react";

interface ActivityLogsProps {
  onNavigateBack: () => void;
  uuid: string;
}

interface LogItem {
  _id: string;
  action: string;
  timestamp: string;
}

const getIconForAction = (action: string) => {
  if (action.startsWith("User Registered")) return <UserPlus className="log-icon" />;
  if (action.startsWith("User Login")) return <LogIn className="log-icon" />;
  if (action.startsWith("Reported Post")) return <ShieldAlert className="log-icon" />;
  if (action.startsWith("Added")) return <LinkIcon className="log-icon" />;
  return <ClipboardList className="log-icon" />;
};

const truncateText = (text: string, maxLength: number = 50) => {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};

export default function ActivityLogs({ onNavigateBack, uuid }: ActivityLogsProps) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5000/api/users/activity/c7033075-9596-4b60-9ddc-e12f9fbecb28`);
      setLogs(response.data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="activity-logs-container">
      <div className="activity-logs-header">
        <button className="back-button" onClick={onNavigateBack}>
          <ArrowLeft className="back-icon" />
        </button>
        <h1 className="title">Activity Logs</h1>
      </div>

      <div className="activity-logs-content">
        {loading ? (
          <div className="loading-container">
            <Loader2 className="animate-spin" />
            <p className="loading-text">Loading activity logs...</p>
          </div>
        ) : logs.length > 0 ? (
          <div className="logs-list">
            <div className="logs-list-container">
              {logs.map((log) => (
                <div key={log._id} className="log-item">
                  <div className="log-info">
                    {getIconForAction(log.action)}
                    <div className="log-details">
                      <span className="log-action">{truncateText(log.action)}</span>
                      <p className="log-timestamp">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <ClipboardList className="empty-icon" />
            <p className="empty-message">No activity logs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
