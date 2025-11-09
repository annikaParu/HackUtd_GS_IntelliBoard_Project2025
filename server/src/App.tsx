import { useState, useEffect } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

interface ExtractedFields {
  businessName: string
  registrationNo: string
  address: string
  entityType: string
}

interface RiskResult {
  score: number
  band: string
  reasons: string[]
  checks: Array<{ label: string; status: 'ok' | 'warn' | 'fail' }>
}

interface ActivityEvent {
  id?: string
  actor?: string
  type?: string
  vendorId?: string | null
  payload?: any
  at?: string
  t?: string  // Legacy format timestamp
  msg?: string  // Legacy format message
}

interface Vendor {
  id: string
  name: string
  email?: string
  country?: string
  bank?: string
  address?: string
  taxId?: string
  risk?: number
  status?: string
  lifecyclePhase?: 'needs-assessment' | 'vendor-selection' | 'contract-negotiation' | 'onboarding' | 'performance-management' | 'risk-monitoring' | 'offboarding' | 'offboarded'
  onboarded?: boolean
  credentials?: {
    accessLevel?: string
    systems?: string[]
    provisionedAt?: string
  }
}

type View = 'home' | 'vendors' | 'compliance' | 'settings'

function App() {
  const [currentView, setCurrentView] = useState<View>('home')
  const [activeTab, setActiveTab] = useState('Draft')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null)
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorName, setVendorName] = useState('Acme Technologies Inc')
  const [error, setError] = useState<string | null>(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)

  // Fetch activities and vendors
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activityRes, vendorsRes] = await Promise.all([
          fetch(`${API_URL}/activity`),
          fetch(`${API_URL}/api/vendors`)
        ])
        
        if (activityRes.ok) {
          const activityData = await activityRes.json()
          setActivities(activityData)
        }
        
        if (vendorsRes.ok) {
          const vendorsData = await vendorsRes.json()
          setVendors(vendorsData)
        }
      } catch (e) {
        console.error('Failed to fetch data:', e)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setUploadedFile(file)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_URL}/extract`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Extraction failed')
      }

      const data = await res.json()
      setExtracted(data.extracted)
      setVendorName(data.extracted.businessName || 'Acme Technologies Inc')
      
      // Refresh data
      const activityRes = await fetch(`${API_URL}/activity`)
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(activityData)
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      setError(error.message || 'Failed to extract document. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!extracted) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/risk/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: extracted })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Risk scoring failed')
      }

      const data = await res.json()
      setRiskResult(data)
      setActiveTab('AI Review')
      
      // Refresh data
      const activityRes = await fetch(`${API_URL}/activity`)
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(activityData)
      }
    } catch (error: any) {
      console.error('Risk score error:', error)
      setError(error.message || 'Failed to calculate risk score.')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (field: keyof ExtractedFields, value: string) => {
    if (!extracted) return
    setExtracted({ ...extracted, [field]: value })
  }

  const getRiskColor = (band: string) => {
    if (band === 'Low') return 'text-green-600'
    if (band === 'Medium') return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusColor = (status: string) => {
    if (status === 'ok') return 'bg-green-500'
    if (status === 'warn') return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTrustScore = (riskScore?: number) => {
    if (!riskScore) return 0
    // Convert risk score (0-100) to trust score (0-100)
    // Higher risk = lower trust
    return 100 - riskScore
  }

  const formatActivityMessage = (activity: ActivityEvent) => {
    if (activity.payload?.msg) {
      return activity.payload.msg
    }
    if (activity.payload?.filename) {
      return `Uploaded: ${activity.payload.filename}`
    }
    if (activity.payload?.score !== undefined) {
      return `Risk scored: ${activity.payload.score} (${activity.payload.band})`
    }
    return `${activity.type}: ${JSON.stringify(activity.payload).slice(0, 50)}`
  }

  // Render different views
  const renderHomeView = () => (
    <>
      <div className="vendor-header">
        <h2 className="vendor-title">{vendorName}</h2>
        <button className="smarter-trust-btn">Smarter Trust</button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['Draft', 'AI Review', 'Compliance Check', 'Approved'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Draft' && (
        <>
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

      <div className="card">
            {uploadedFile ? (
              <div className="uploaded-doc">
                <div className="doc-icon">✓</div>
                <div>
                  <div className="doc-name">{uploadedFile.name}</div>
                  <div className="doc-status">Uploaded</div>
                </div>
              </div>
            ) : (
              <div className="upload-area">
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.txt"
                  onChange={handleFileUpload}
                  className="file-input"
                  disabled={loading}
                />
                <label htmlFor="file-upload" className="upload-label">
                  {loading ? '⏳ Processing...' : '📄 Upload Document'}
                </label>
                <p className="upload-hint">PDF or TXT files only</p>
              </div>
            )}

            {extracted && (
              <div className="extracted-section">
                <h3 className="section-title">AI-Extracted Information</h3>
                <div className="fields-table">
                  <div className="field-row">
                    <label>Business Name</label>
                    <input
                      type="text"
                      value={extracted.businessName}
                      onChange={(e) => handleFieldChange('businessName', e.target.value)}
                      className="field-input"
                      placeholder="Enter business name"
                    />
                  </div>
                  <div className="field-row">
                    <label>Registration No.</label>
                    <input
                      type="text"
                      value={extracted.registrationNo}
                      onChange={(e) => handleFieldChange('registrationNo', e.target.value)}
                      className="field-input"
                      placeholder="Enter registration number"
                    />
                  </div>
                  <div className="field-row">
                    <label>Address</label>
                    <input
                      type="text"
                      value={extracted.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      className="field-input"
                      placeholder="Enter address"
                    />
                  </div>
                  <div className="field-row">
                    <label>Entity Type</label>
                    <input
                      type="text"
                      value={extracted.entityType}
                      onChange={(e) => handleFieldChange('entityType', e.target.value)}
                      className="field-input"
                      placeholder="Enter entity type"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="action-buttons">
              <button className="btn-flag">Flag Vendor</button>
              <button
                className="btn-approve"
                onClick={handleApprove}
                disabled={!extracted || loading}
              >
                {loading ? 'Processing...' : 'Approve'}
        </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'AI Review' && (
        <div className="card">
          <h3 className="section-title">AI Review Results</h3>
          {riskResult ? (
            <div className="review-content">
              <div className="review-summary">
                <div className="review-score">
                  <span className="score-label">Risk Score:</span>
                  <span className={`score-value ${getRiskColor(riskResult.band)}`}>
                    {riskResult.score}/100
                  </span>
                  <span className={`score-band ${getRiskColor(riskResult.band)}`}>
                    ({riskResult.band})
                  </span>
                </div>
                <div className="trust-score-container">
                  <span className="trust-label">Trust Score:</span>
                  <div className="trust-score-bar">
                    <div 
                      className="trust-score-fill" 
                      style={{ width: `${getTrustScore(riskResult.score)}%` }}
                    >
                      {getTrustScore(riskResult.score)}%
                    </div>
                  </div>
                </div>
              </div>
              <div className="review-checks">
                <h4>Assessment Checks</h4>
                {riskResult.checks.map((check, idx) => (
                  <div key={idx} className="review-check-item">
                    <div className={`check-status ${getStatusColor(check.status)}`}>
                      {check.status === 'ok' ? '✓' : check.status === 'warn' ? '?' : '✗'}
                    </div>
                    <span>{check.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty-state">No AI review available. Please upload a document and click Approve.</p>
          )}
        </div>
      )}

      {activeTab === 'Compliance Check' && (
        <>
          {riskResult ? (
            <div className="compliance-dashboard">
              <div className="card">
                <div className="compliance-header">
                  <div>
                    <h3 className="section-title">Compliance Status</h3>
                    <p className="compliance-subtitle">Regulatory compliance assessment for {vendorName}</p>
                  </div>
                  <div className={`compliance-badge-large ${riskResult.score >= 80 ? 'compliant' : riskResult.score >= 50 ? 'review' : 'non-compliant'}`}>
                    {riskResult.score >= 80 ? '✓ Compliant' : riskResult.score >= 50 ? '⚠ Review Required' : '✗ Non-Compliant'}
                  </div>
                </div>
              </div>

              <div className="compliance-grid">
                <div className="card">
                  <h4 className="compliance-section-title">📋 Regulatory Requirements</h4>
                  <div className="requirements-list">
                    <div className={`requirement-item ${riskResult.checks.find(c => c.label.includes('Registration'))?.status === 'ok' ? 'passed' : 'pending'}`}>
                      <div className="requirement-header">
                        <span className="requirement-icon">
                          {riskResult.checks.find(c => c.label.includes('Registration'))?.status === 'ok' ? '✓' : '⏳'}
                        </span>
                        <span className="requirement-name">Business Registration</span>
                        <span className={`requirement-status ${riskResult.checks.find(c => c.label.includes('Registration'))?.status === 'ok' ? 'passed' : 'pending'}`}>
                          {riskResult.checks.find(c => c.label.includes('Registration'))?.status === 'ok' ? 'Passed' : 'Pending'}
                        </span>
                      </div>
                      <p className="requirement-desc">Valid business registration number required for vendor onboarding</p>
                    </div>

                    <div className={`requirement-item ${riskResult.checks.find(c => c.label.includes('Address'))?.status === 'ok' ? 'passed' : 'pending'}`}>
                      <div className="requirement-header">
                        <span className="requirement-icon">
                          {riskResult.checks.find(c => c.label.includes('Address'))?.status === 'ok' ? '✓' : '⏳'}
                        </span>
                        <span className="requirement-name">Physical Address Verification</span>
                        <span className={`requirement-status ${riskResult.checks.find(c => c.label.includes('Address'))?.status === 'ok' ? 'passed' : 'pending'}`}>
                          {riskResult.checks.find(c => c.label.includes('Address'))?.status === 'ok' ? 'Passed' : 'Pending'}
                        </span>
                      </div>
                      <p className="requirement-desc">Complete business address must be verified for compliance</p>
                    </div>

                    <div className={`requirement-item ${riskResult.checks.find(c => c.label.includes('watchlist'))?.status === 'ok' ? 'passed' : 'failed'}`}>
                      <div className="requirement-header">
                        <span className="requirement-icon">
                          {riskResult.checks.find(c => c.label.includes('watchlist'))?.status === 'ok' ? '✓' : '✗'}
                        </span>
                        <span className="requirement-name">Sanctions & Watchlist Check</span>
                        <span className={`requirement-status ${riskResult.checks.find(c => c.label.includes('watchlist'))?.status === 'ok' ? 'passed' : 'failed'}`}>
                          {riskResult.checks.find(c => c.label.includes('watchlist'))?.status === 'ok' ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                      <p className="requirement-desc">Vendor must not appear on any sanctions or watchlists</p>
                    </div>

                    <div className="requirement-item pending">
                      <div className="requirement-header">
                        <span className="requirement-icon">⏳</span>
                        <span className="requirement-name">Financial History Review</span>
                        <span className="requirement-status pending">Pending</span>
                      </div>
                      <p className="requirement-desc">Financial history verification required for complete compliance</p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h4 className="compliance-section-title">📊 Compliance Score Breakdown</h4>
                  <div className="compliance-metrics">
                    <div className="metric-item">
                      <div className="metric-label">Overall Compliance</div>
                      <div className="metric-bar-container">
                        <div 
                          className={`metric-bar ${riskResult.score >= 80 ? 'high' : riskResult.score >= 50 ? 'medium' : 'low'}`}
                          style={{ width: `${riskResult.score}%` }}
                        >
                          {riskResult.score}%
                        </div>
                      </div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-label">Documentation</div>
                      <div className="metric-bar-container">
                        <div 
                          className="metric-bar high"
                          style={{ width: `${extracted ? 85 : 0}%` }}
                        >
                          {extracted ? '85%' : '0%'}
                        </div>
                      </div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-label">Risk Assessment</div>
                      <div className="metric-bar-container">
                        <div 
                          className={`metric-bar ${riskResult.score >= 80 ? 'high' : riskResult.score >= 50 ? 'medium' : 'low'}`}
                          style={{ width: `${riskResult.score}%` }}
                        >
                          {riskResult.score}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h4 className="compliance-section-title">🔍 Detailed Compliance Checks</h4>
                  <div className="detailed-checks">
                    {riskResult.checks.map((check, idx) => (
                      <div key={idx} className={`detailed-check-item ${check.status}`}>
                        <div className="check-header">
                          <div className="check-left">
                            <div className={`check-status-icon ${check.status}`}>
                              {check.status === 'ok' ? '✓' : check.status === 'warn' ? '⚠' : '✗'}
                            </div>
                            <span className="check-label">{check.label}</span>
                          </div>
                          <span className={`check-badge ${check.status}`}>
                            {check.status === 'ok' ? 'Compliant' : check.status === 'warn' ? 'Review' : 'Non-Compliant'}
                          </span>
                        </div>
                        <div className="check-details">
                          {check.status === 'ok' && (
                            <p className="check-message">✓ This requirement has been met and verified.</p>
                          )}
                          {check.status === 'warn' && (
                            <p className="check-message">⚠ Additional verification may be required for this item.</p>
                          )}
                          {check.status === 'fail' && (
                            <p className="check-message">✗ This requirement has not been met. Action required.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h4 className="compliance-section-title">📝 Compliance Notes & Actions</h4>
                  <div className="compliance-actions">
                    <div className="action-item">
                      <div className="action-icon">📋</div>
                      <div className="action-content">
                        <div className="action-title">Next Steps</div>
                        <div className="action-description">
                          {riskResult.score >= 80 
                            ? 'Vendor meets all compliance requirements. Ready for approval.'
                            : riskResult.score >= 50
                            ? 'Vendor requires manual review before final approval.'
                            : 'Vendor does not meet compliance requirements. Additional documentation needed.'}
                        </div>
                      </div>
                    </div>
                    <div className="action-item">
                      <div className="action-icon">⏰</div>
                      <div className="action-content">
                        <div className="action-title">Review Timeline</div>
                        <div className="action-description">
                          Compliance review completed: {new Date().toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="action-item">
                      <div className="action-icon">👤</div>
                      <div className="action-content">
                        <div className="action-title">Reviewed By</div>
                        <div className="action-description">AI Compliance System</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <p className="empty-state">No compliance data available. Please complete AI Review first.</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'Approved' && (
        <div className="card">
          <h3 className="section-title">Approval Status</h3>
          {riskResult ? (
            <div className="approval-content">
              {riskResult.score >= 80 ? (
                <div className="approval-success">
                  <div className="approval-icon">✓</div>
                  <h3>Vendor Approved</h3>
                  <p>This vendor has been approved for onboarding based on the risk assessment.</p>
                  <div className="approval-details">
                    <div className="approval-detail-item">
                      <span className="detail-label">Risk Score:</span>
                      <span className="detail-value">{riskResult.score}/100</span>
                    </div>
                    <div className="approval-detail-item">
                      <span className="detail-label">Trust Score:</span>
                      <span className="detail-value">{getTrustScore(riskResult.score)}%</span>
                    </div>
                    <div className="approval-detail-item">
                      <span className="detail-label">Status:</span>
                      <span className="detail-value">{riskResult.band}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="approval-pending">
                  <div className="approval-icon">⏳</div>
                  <h3>Approval Pending</h3>
                  <p>This vendor requires manual review before approval.</p>
                  <div className="approval-details">
                    <div className="approval-detail-item">
                      <span className="detail-label">Risk Score:</span>
                      <span className="detail-value">{riskResult.score}/100</span>
                    </div>
                    <div className="approval-detail-item">
                      <span className="detail-label">Trust Score:</span>
                      <span className="detail-value">{getTrustScore(riskResult.score)}%</span>
                    </div>
                    <div className="approval-detail-item">
                      <span className="detail-label">Status:</span>
                      <span className="detail-value">{riskResult.band}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="empty-state">No approval data available. Please complete the review process.</p>
          )}
        </div>
      )}

      {/* Activity Log */}
      <div className="activity-log">
        <h3 className="section-title">Activity Log</h3>
        <div className="activity-list">
          {activities.length === 0 ? (
            <div className="activity-item">No activities yet</div>
          ) : (
            activities.slice(0, 5).map((activity) => (
                  <div key={activity.id || activity.at || activity.t} className="activity-item">
                    <span className="activity-time">
                      {new Date(activity.at || activity.t || Date.now()).toLocaleTimeString()}
                    </span>
                <span className="activity-msg">
                  {formatActivityMessage(activity)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )

  const handleOnboard = async (vendor: Vendor) => {
    try {
      // Update vendor to onboarded status
      const updatedVendor = {
        ...vendor,
        onboarded: true,
        lifecyclePhase: 'onboarding' as const,
        credentials: {
          accessLevel: 'Vendor: AP-Portal-SubmitOnly',
          systems: ['AP Portal', 'Vendor Portal', 'Document Management'],
          provisionedAt: new Date().toISOString()
        }
      }
      
      // In a real app, this would call an API endpoint
      setVendors(vendors.map(v => v.id === vendor.id ? updatedVendor : v))
      setSelectedVendor(updatedVendor)
      
      // Add activity
      const activityRes = await fetch(`${API_URL}/activity`)
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(activityData)
      }
    } catch (error) {
      console.error('Onboarding error:', error)
      setError('Failed to onboard vendor')
    }
  }

  const handleOffboard = async (vendor: Vendor) => {
    if (!confirm(`Are you sure you want to offboard ${vendor.name}? This will revoke all credentials.`)) {
      return
    }

    try {
      const updatedVendor = {
        ...vendor,
        onboarded: false,
        lifecyclePhase: 'offboarded' as const,
        credentials: undefined
      }
      
      setVendors(vendors.map(v => v.id === vendor.id ? updatedVendor : v))
      setSelectedVendor(null)
      
      const activityRes = await fetch(`${API_URL}/activity`)
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(activityData)
      }
    } catch (error) {
      console.error('Offboarding error:', error)
      setError('Failed to offboard vendor')
    }
  }

  const handleLifecycleAction = (vendor: Vendor, phase: Vendor['lifecyclePhase']) => {
    const updatedVendor = {
      ...vendor,
      lifecyclePhase: phase
    }
    setVendors(vendors.map(v => v.id === vendor.id ? updatedVendor : v))
    setSelectedVendor(updatedVendor)
  }

  const renderVendorsView = () => {
    const approvedVendors = vendors.filter(v => (v.risk || 0) >= 80 || v.status === 'Approved')
    
    return (
      <div className="history-view">
        <h2 className="page-title">Approved Vendors</h2>
        <div className="vendors-list">
          {approvedVendors.length === 0 ? (
            <div className="empty-state">No approved vendors yet</div>
          ) : (
            approvedVendors.map((vendor) => (
              <div 
                key={vendor.id} 
                className="vendor-card clickable"
                onClick={() => setSelectedVendor(vendor)}
              >
                <div className="vendor-card-header">
                  <h3 className="vendor-card-name">{vendor.name}</h3>
                  <div className={`vendor-status-badge ${vendor.status?.toLowerCase().replace(' ', '-')}`}>
                    {vendor.status || 'Pending'}
                  </div>
                </div>
                <div className="vendor-card-details">
                  {vendor.email && (
                    <div className="vendor-detail">
                      <span className="detail-icon">📧</span>
                      <span>{vendor.email}</span>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="vendor-detail">
                      <span className="detail-icon">📍</span>
                      <span>{vendor.address}</span>
                    </div>
                  )}
                  {vendor.country && (
                    <div className="vendor-detail">
                      <span className="detail-icon">🌍</span>
                      <span>{vendor.country}</span>
                    </div>
                  )}
                  {vendor.onboarded && (
                    <div className="vendor-detail onboarded-badge">
                      <span className="detail-icon">✓</span>
                      <span>Onboarded</span>
                    </div>
                  )}
                </div>
                <div className="vendor-card-footer">
                  <div className="vendor-risk-score">
                    <span className="risk-label">Risk:</span>
                    <span className={`risk-value ${vendor.risk && vendor.risk >= 80 ? 'low' : vendor.risk && vendor.risk >= 50 ? 'medium' : 'high'}`}>
                      {vendor.risk || 'N/A'}
                    </span>
                  </div>
                  <div className="vendor-trust-score">
                    <span className="trust-label">Trust:</span>
                    <div className="trust-mini-bar">
                      <div 
                        className="trust-mini-fill" 
                        style={{ width: `${getTrustScore(vendor.risk)}%` }}
                      />
                    </div>
                    <span className="trust-value">{getTrustScore(vendor.risk)}%</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  const renderVendorDetailView = (vendor: Vendor) => {
    const lifecyclePhases = [
      { id: 'needs-assessment', name: 'Needs Assessment', description: 'Define requirements and align stakeholders' },
      { id: 'vendor-selection', name: 'Vendor Selection', description: 'Research and evaluate potential vendors' },
      { id: 'contract-negotiation', name: 'Contract Negotiation', description: 'Negotiate terms and finalize agreement' },
      { id: 'onboarding', name: 'Onboarding', description: 'Set up vendor in systems and provision access' },
      { id: 'performance-management', name: 'Performance Management', description: 'Monitor and measure vendor performance' },
      { id: 'risk-monitoring', name: 'Risk & Compliance Monitoring', description: 'Continuous risk assessment and compliance checks' },
      { id: 'offboarding', name: 'Offboarding', description: 'Terminate relationship and revoke access' }
    ]

    const currentPhaseId = vendor.lifecyclePhase || 'needs-assessment'
    const currentPhaseIndex = lifecyclePhases.findIndex(p => p.id === currentPhaseId)

    return (
      <div className="vendor-detail-view">
        <div className="vendor-detail-header">
          <button className="back-button" onClick={() => setSelectedVendor(null)}>
            ← Back to Vendors
          </button>
          <div className="vendor-detail-title">
            <h2 className="page-title">{vendor.name}</h2>
            <div className={`vendor-status-badge ${vendor.status?.toLowerCase().replace(' ', '-')}`}>
              {vendor.status || 'Pending'}
            </div>
          </div>
        </div>

        <div className="vendor-detail-content">
          <div className="card">
            <h3 className="section-title">Vendor Information</h3>
            <div className="vendor-info-grid">
              {vendor.email && (
                <div className="info-item">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{vendor.email}</span>
                </div>
              )}
              {vendor.address && (
                <div className="info-item">
                  <span className="info-label">Address:</span>
                  <span className="info-value">{vendor.address}</span>
                </div>
              )}
              {vendor.country && (
                <div className="info-item">
                  <span className="info-label">Country:</span>
                  <span className="info-value">{vendor.country}</span>
                </div>
              )}
              {vendor.taxId && (
                <div className="info-item">
                  <span className="info-label">Tax ID:</span>
                  <span className="info-value">{vendor.taxId}</span>
                </div>
              )}
              <div className="info-item">
                <span className="info-label">Risk Score:</span>
                <span className={`info-value ${vendor.risk && vendor.risk >= 80 ? 'low' : vendor.risk && vendor.risk >= 50 ? 'medium' : 'high'}`}>
                  {vendor.risk || 'N/A'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Trust Score:</span>
                <span className="info-value">{getTrustScore(vendor.risk)}%</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Vendor Lifecycle Management</h3>
            <div className="lifecycle-phases">
              {lifecyclePhases.map((phase, index) => {
                const isActive = vendor.lifecyclePhase === phase.id
                const isCompleted = index < currentPhaseIndex
                const isNext = index === currentPhaseIndex + 1
                
                return (
                  <div 
                    key={phase.id} 
                    className={`lifecycle-phase ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isNext ? 'next' : ''}`}
                  >
                    <div className="phase-header">
                      <div className="phase-number">{index + 1}</div>
                      <div className="phase-info">
                        <div className="phase-name">{phase.name}</div>
                        <div className="phase-description">{phase.description}</div>
                      </div>
                      {isActive && <div className="phase-badge active">Current</div>}
                      {isCompleted && <div className="phase-badge completed">✓</div>}
                    </div>
                    {isActive && (
                      <div className="phase-actions">
                        {phase.id === 'onboarding' && !vendor.onboarded && (
                          <button 
                            className="btn-primary"
                            onClick={() => handleOnboard(vendor)}
                          >
                            Onboard Vendor
                          </button>
                        )}
                        {phase.id === 'onboarding' && vendor.onboarded && (
                          <div className="onboarded-status">
                            <span className="onboarded-icon">✓</span>
                            <span>Vendor has been onboarded</span>
                            <button 
                              className="btn-danger"
                              onClick={() => handleOffboard(vendor)}
                            >
                              Revoke Access
                            </button>
                          </div>
                        )}
                        {phase.id === 'offboarding' && (
                          <button 
                            className="btn-danger"
                            onClick={() => handleOffboard(vendor)}
                          >
                            Offboard Vendor
                          </button>
                        )}
                        {phase.id !== 'onboarding' && phase.id !== 'offboarding' && (
                          <button 
                            className="btn-secondary"
                            onClick={() => handleLifecycleAction(vendor, phase.id as Vendor['lifecyclePhase'])}
                          >
                            Mark as {phase.name}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {vendor.onboarded && vendor.credentials && (
            <div className="card">
              <h3 className="section-title">Provisioned Credentials</h3>
              <div className="credentials-info">
                <div className="credential-item">
                  <span className="credential-label">Access Level:</span>
                  <span className="credential-value">{vendor.credentials.accessLevel}</span>
                </div>
                <div className="credential-item">
                  <span className="credential-label">Systems:</span>
                  <div className="systems-list">
                    {vendor.credentials.systems?.map((system, idx) => (
                      <span key={idx} className="system-badge">{system}</span>
                    ))}
                  </div>
                </div>
                <div className="credential-item">
                  <span className="credential-label">Provisioned At:</span>
                  <span className="credential-value">
                    {vendor.credentials.provisionedAt 
                      ? new Date(vendor.credentials.provisionedAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                <button 
                  className="btn-danger"
                  onClick={() => handleOffboard(vendor)}
                >
                  Revoke All Credentials
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderComplianceView = () => (
    <div className="compliance-view">
      <h2 className="page-title">Compliance Dashboard</h2>
      <div className="compliance-overview">
        <div className="card">
          <h3 className="section-title">Overall Compliance Status</h3>
          <div className="compliance-stats">
            <div className="stat-card">
              <div className="stat-value">{vendors.filter(v => (v.risk || 0) >= 80).length}</div>
              <div className="stat-label">Compliant Vendors</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{vendors.filter(v => (v.risk || 0) >= 50 && (v.risk || 0) < 80).length}</div>
              <div className="stat-label">Under Review</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{vendors.filter(v => (v.risk || 0) < 50).length}</div>
              <div className="stat-label">Non-Compliant</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{vendors.length}</div>
              <div className="stat-label">Total Vendors</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Compliance Requirements</h3>
          <div className="requirements-overview">
            <div className="requirement-overview-item">
              <span className="req-icon">✓</span>
              <span className="req-text">Business Registration Verification</span>
            </div>
            <div className="requirement-overview-item">
              <span className="req-icon">✓</span>
              <span className="req-text">Address Validation</span>
            </div>
            <div className="requirement-overview-item">
              <span className="req-icon">✓</span>
              <span className="req-text">Sanctions & Watchlist Screening</span>
            </div>
            <div className="requirement-overview-item">
              <span className="req-icon">⏳</span>
              <span className="req-text">Financial History Review</span>
            </div>
            <div className="requirement-overview-item">
              <span className="req-icon">✓</span>
              <span className="req-text">Risk Assessment</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Recent Compliance Activities</h3>
          <div className="compliance-activities">
            {activities
              .filter(a => a.type === 'score' || a.type === 'extract' || a.type === 'upload')
              .slice(0, 10)
              .map((activity) => (
                <div key={activity.id || activity.at || activity.t} className="compliance-activity-item">
                  <div className="activity-time-small">
                    {new Date(activity.at || activity.t || Date.now()).toLocaleString()}
                  </div>
                  <div className="activity-description">
                    {formatActivityMessage(activity)}
                  </div>
                </div>
              ))}
            {activities.filter(a => a.type === 'score' || a.type === 'extract' || a.type === 'upload').length === 0 && (
              <div className="empty-state">No compliance activities yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside 
        className={`sidebar ${sidebarExpanded ? 'expanded' : ''}`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className="sidebar-logo">
          <span className="logo-text">GS</span>
          {sidebarExpanded && <span className="logo-expanded">Goldman Sachs</span>}
        </div>
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            <span className="nav-icon">🏠</span>
            {sidebarExpanded && <span className="nav-label">Home</span>}
          </div>
          <div 
            className={`nav-item ${currentView === 'vendors' ? 'active' : ''}`}
            onClick={() => { setCurrentView('vendors'); setSelectedVendor(null); }}
          >
            <span className="nav-icon">📋</span>
            {sidebarExpanded && <span className="nav-label">Approved Vendors</span>}
          </div>
          <div 
            className={`nav-item ${currentView === 'compliance' ? 'active' : ''}`}
            onClick={() => setCurrentView('compliance')}
          >
            <span className="nav-icon">📁</span>
            {sidebarExpanded && <span className="nav-label">Compliance</span>}
          </div>
        </nav>
        <div className="sidebar-user">
          <span className="user-icon">👤</span>
          {sidebarExpanded && <span className="user-label">User</span>}
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <div>
            <h1 className="app-title">IntelliBoard</h1>
            <p className="app-tagline">Smarter Vendor Onboarding. Transparent Risk. Instant Trust.</p>
          </div>
          <div className="topbar-badge">Prototype @ HackUTD 2025</div>
        </header>

        {/* Content Area */}
        <div className="content-area">
          {/* Left Panel */}
          <div className="left-panel">
            {currentView === 'home' && renderHomeView()}
            {currentView === 'vendors' && (selectedVendor ? renderVendorDetailView(selectedVendor) : renderVendorsView())}
            {currentView === 'compliance' && renderComplianceView()}
          </div>

          {/* Right Rail */}
          <div className="right-rail">
            {/* Risk Score */}
            {riskResult && currentView === 'home' && (
              <>
                <div className="card">
                  <div className="risk-gauge-container">
                    <div className="risk-gauge">
                      <svg className="gauge-svg" viewBox="0 0 120 120">
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="10"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke={riskResult.band === 'Low' ? '#10b981' : riskResult.band === 'Medium' ? '#f59e0b' : '#ef4444'}
                          strokeWidth="10"
                          strokeDasharray={`${(riskResult.score / 100) * 314} 314`}
                          strokeDashoffset="78.5"
                          transform="rotate(-90 60 60)"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="gauge-value">{riskResult.score}</div>
                    </div>
                    <div className={`risk-band ${getRiskColor(riskResult.band)}`}>
                      {riskResult.band}
                    </div>
                    <div className="trust-score-display">
                      <span className="trust-score-label">Trust Score</span>
                      <span className="trust-score-number">{getTrustScore(riskResult.score)}%</span>
                    </div>
                  </div>
                </div>

                {/* AI Risk Assessment */}
                <div className="card">
                  <h3 className="section-title">AI Risk Assessment</h3>
                  <div className="checks-list">
                    {riskResult.checks.map((check, idx) => (
                      <div key={idx} className="check-item">
                        <div className={`status-dot ${getStatusColor(check.status)}`}>
                          {check.status === 'ok' ? '✓' : check.status === 'warn' ? '?' : '✗'}
                        </div>
                        <span>{check.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Explainability */}
                <div className="card">
                  <h3 className="section-title">AI Explainability</h3>
                  <ul className="reasons-list">
                    {riskResult.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            
            {(!riskResult || currentView !== 'home') && (
              <div className="card">
                <p className="empty-state">
                  {currentView === 'home' 
                    ? 'Upload a document and click Approve to see risk assessment'
                    : 'Select a vendor to view details'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
