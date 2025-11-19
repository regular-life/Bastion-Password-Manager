import React, { useState, useEffect } from 'react';
import { getMyFamily, getAuditLog } from '../api';

function AuditLog({ token }) {
  const [family, setFamily] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    try {
      setLoading(true);

      // Load family info
      const familyData = await getMyFamily(token);
      setFamily(familyData.family);

      // Only owners can view audit logs
      if (familyData.family.role !== 'owner') {
        setError('Only family owners can view audit logs');
        setLoading(false);
        return;
      }

      // Load audit logs
      const auditData = await getAuditLog(token, familyData.family.id);
      setLogs(auditData.logs || []);
      setError('');
    } catch (err) {
      if (err.status === 404) {
        setFamily(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getActionLabel = (action) => {
    const labels = {
      'request_token': 'Requested Fill Token',
      'use_token': 'Used Fill Token',
      'share': 'Shared Credential',
      'unshare': 'Unshared Credential',
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    const colors = {
      'request_token': '#2196F3',
      'use_token': '#4CAF50',
      'share': '#FF9800',
      'unshare': '#F44336',
    };
    return colors[action] || '#666';
  };

  if (loading) {
    return <div className="loading">Loading audit log...</div>;
  }

  if (!family) {
    return (
      <div className="info-box">
        <p>You need to create or join a family first to view audit logs.</p>
      </div>
    );
  }

  if (family.role !== 'owner') {
    return (
      <div className="info-box">
        <p>Only family owners can view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="audit-log">
      <h2>Audit Log</h2>
      <p className="info">Security events for {family.name}</p>

      {error && <div className="error">{error}</div>}

      {logs.length > 0 ? (
        <div className="logs-list">
          {logs.map((log) => (
            <div key={log.id} className="log-entry">
              <div className="log-header">
                <span
                  className="log-action"
                  style={{ color: getActionColor(log.action) }}
                >
                  {getActionLabel(log.action)}
                </span>
                <span className="log-timestamp">{formatDate(log.timestamp)}</span>
              </div>
              <div className="log-details">
                <p><strong>User:</strong> {log.user_email}</p>
                {log.credential_url && (
                  <p><strong>Credential:</strong> {log.credential_url}</p>
                )}
                {log.origin && (
                  <p><strong>Origin:</strong> {log.origin}</p>
                )}
                {log.details && (
                  <p><strong>Details:</strong> {log.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="info">No audit events yet.</p>
      )}
    </div>
  );
}

export default AuditLog;
