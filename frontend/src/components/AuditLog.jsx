import React, { useState, useEffect } from 'react';
import { getMyFamily, getAuditLog } from '../api';

function AuditLog({ token }) {
  const [families, setFamilies] = useState([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    try {
      setLoading(true);

      // Load families
      const familyData = await getMyFamily(token);
      const allFamilies = familyData.families || [];

      // Filter for families where user is owner
      const ownerFamilies = allFamilies.filter(f => f.role === 'owner');
      setFamilies(ownerFamilies);

      // Select first family if available
      if (ownerFamilies.length > 0 && !selectedFamilyId) {
        setSelectedFamilyId(ownerFamilies[0].id);
      }

      setError('');
    } catch (err) {
      if (err.status === 404) {
        setFamilies([]);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFamilyId && families.length > 0) {
      loadFamilyLogs(selectedFamilyId);
    }
  }, [selectedFamilyId, families]);

  const loadFamilyLogs = async (familyId) => {
    try {
      setLoading(true);
      const currentFamily = families.find(f => f.id === familyId);
      setSelectedFamily(currentFamily);

      // Load audit logs
      const auditData = await getAuditLog(token, familyId);
      setLogs(auditData.logs || []);
      setError('');
    } catch (err) {
      setError(err.message);
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

  if (families.length === 0) {
    return (
      <div className="info-box">
        <p>You need to be a family owner to view audit logs.</p>
      </div>
    );
  }

  if (!selectedFamily) return null;

  return (

    <div className="audit-log">
      <h2>Audit Log</h2>

      <div className="form-group">
        <label>Select Family</label>
        <select
          value={selectedFamilyId}
          onChange={(e) => setSelectedFamilyId(e.target.value)}
        >
          {families.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      <p className="info">Security events for {selectedFamily.name}</p>

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
                <span className="log-timestamp">{formatDate(log.created_at)}</span>
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
