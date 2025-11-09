import { useState, useEffect } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

interface ExtractedFields {
  businessName: string
  registrationNo: string
  address: string
  entityType: string
}

interface PrivacyAnalysis {
  hasPII: boolean
  riskLevel: 'low' | 'medium' | 'high'
  detectedTypes: string[]
  piiCount: number
  recommendations: string[]
  fieldsWithPII?: Array<{ field: string; types: string[]; count: number }>
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

type View = 'home' | 'vendors' | 'flagged' | 'approved' | 'compliance' | 'settings'

function App() {
  const [currentView, setCurrentView] = useState<View>('home')
  const [activeTab, setActiveTab] = useState('Draft')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null)
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null)
  const [privacyAnalysis, setPrivacyAnalysis] = useState<PrivacyAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorName, setVendorName] = useState('AI Manager')
  const [entityType, setEntityType] = useState<'vendor' | 'client'>('vendor')
  const [error, setError] = useState<string | null>(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [flaggedVendors, setFlaggedVendors] = useState<Array<{
    id: string
    extracted: ExtractedFields
    riskResult: RiskResult
    flaggedAt: string
    vendorName: string
    entityType: 'vendor' | 'client'
  }>>([])
  const [approvedVendors, setApprovedVendors] = useState<Array<{
    id: string
    extracted: ExtractedFields
    riskResult: RiskResult
    approvedAt: string
    vendorName: string
    entityType: 'vendor' | 'client'
    lifecyclePhase: string
  }>>([])
  const [selectedApprovedVendor, setSelectedApprovedVendor] = useState<typeof approvedVendors[0] | null>(null)

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

    // Validate file type
    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file')
      return
    }

    setLoading(true)
    setError(null)
    setUploadedFile(file)

    try {
      console.log(`📤 Uploading file: ${file.name} (${file.size} bytes)`)
      
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_URL}/extract`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Extraction failed'
        console.error('❌ Upload failed:', errorMessage)
        throw new Error(errorMessage)
      }

      const data = await res.json()
      console.log('✅ Extraction successful:', data)
      
      // Validate response structure
      if (!data.extracted) {
        throw new Error('Invalid response from server: missing extracted fields')
      }

      // Ensure all fields exist
      const extracted = {
        businessName: data.extracted.businessName || '',
        registrationNo: data.extracted.registrationNo || '',
        address: data.extracted.address || '',
        entityType: data.extracted.entityType || ''
      }

      setExtracted(extracted)
      
      // Set privacy analysis if available
      if (data.privacy) {
        setPrivacyAnalysis(data.privacy)
        if (data.privacy.hasPII) {
          console.log(`🔒 PII detected: ${data.privacy.piiCount} instances (${data.privacy.detectedTypes.join(', ')})`)
        }
      }
      
      // Use business name if found, otherwise use filename without extension
      const fileName = file.name.replace(/\.[^/.]+$/, '')
      setVendorName(extracted.businessName || fileName || 'AI Manager')
      
      // Show success message
      console.log('✅ Fields extracted:', extracted)
      
      // Automatically calculate risk score after extraction
      console.log('🤖 Automatically calculating risk score...')
      try {
        const riskRes = await fetch(`${API_URL}/risk/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: extracted })
        })

        if (riskRes.ok) {
          const riskData = await riskRes.json()
          setRiskResult(riskData)
          console.log('✅ Risk score calculated:', riskData)
        } else {
          console.warn('⚠️ Risk scoring failed, but extraction succeeded')
        }
      } catch (riskError) {
        console.error('❌ Risk scoring error:', riskError)
        // Don't fail the whole upload if risk scoring fails
      }
      
      // Automatically switch to AI Review tab
      setActiveTab('AI Review')
      
      // Refresh data
      const activityRes = await fetch(`${API_URL}/activity`)
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(activityData)
      }
    } catch (error: any) {
      console.error('❌ Upload error:', error)
      setError(error.message || 'Failed to extract document. Please ensure the file is a valid PDF with extractable text.')
      setUploadedFile(null)
      setExtracted(null)
      setRiskResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!extracted || !riskResult) return

    setLoading(true)
    setError(null)
    try {
      const approvedVendor = {
        id: `approved-${Date.now()}`,
        extracted: { ...extracted },
        riskResult: { ...riskResult },
        approvedAt: new Date().toISOString(),
        vendorName: extracted.businessName || vendorName,
        entityType: entityType,
        lifecyclePhase: 'contract-negotiation' // Start at first phase
      }

      setApprovedVendors([...approvedVendors, approvedVendor])
      setCurrentView('approved')
      
      console.log('✅ Vendor approved:', approvedVendor.vendorName)
      
      // Refresh data
      const activityRes = await fetch(`${API_URL}/activity`)
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivities(activityData)
      }
    } catch (error: any) {
      console.error('Approve error:', error)
      setError(error.message || 'Failed to approve vendor.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setExtracted(null)
    setRiskResult(null)
    setPrivacyAnalysis(null)
    setError(null)
    setActiveTab('Draft')
    setVendorName('AI Manager')
    // Reset file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const handleFlagVendor = () => {
    if (!extracted || !riskResult) {
      setError('Please upload and analyze a document before flagging')
      return
    }

    const flaggedVendor = {
      id: `flagged-${Date.now()}`,
      extracted: { ...extracted },
      riskResult: { ...riskResult },
      flaggedAt: new Date().toISOString(),
      vendorName: extracted.businessName || vendorName,
      entityType: entityType
    }

    setFlaggedVendors([...flaggedVendors, flaggedVendor])
    setCurrentView('flagged')
    
    // Add activity
    console.log('✅ Vendor flagged:', flaggedVendor.vendorName)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h2 className="vendor-title">{vendorName}</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`entity-toggle-btn ${entityType === 'vendor' ? 'active' : ''}`}
              onClick={() => setEntityType('vendor')}
            >
              🏢 Vendor
            </button>
            <button 
              className={`entity-toggle-btn ${entityType === 'client' ? 'active' : ''}`}
              onClick={() => setEntityType('client')}
            >
              👤 Client
            </button>
          </div>
        </div>
        <button className="smarter-trust-btn">Smarter Trust</button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['Draft', 'AI Review', 'Compliance Check'].map(tab => (
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
                <button 
                  className="btn-remove"
                  onClick={handleRemoveFile}
                  title="Remove file and start over"
                >
                  ✕ Remove
                </button>
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
              {uploadedFile && (
                <button 
                  className="btn-remove"
                  onClick={handleRemoveFile}
                >
                  ✕ Remove File
                </button>
              )}
              <button className="btn-flag" onClick={handleFlagVendor} disabled={!extracted || !riskResult}>
                Flag Vendor
              </button>
              <button
                className="btn-approve"
                onClick={handleApprove}
                disabled={!extracted || !riskResult || loading}
              >
                {loading ? 'Processing...' : 'Approve & Proceed'}
        </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'AI Review' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="section-title">AI Review Results</h3>
            {uploadedFile && (
              <button 
                className="btn-remove"
                onClick={handleRemoveFile}
                title="Remove file and start over"
              >
                ✕ Remove File / Start Over
              </button>
            )}
          </div>
          {riskResult ? (
            <div className="review-content">
              <div className="review-summary">
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
            <p className="empty-state">No AI review available. Please upload a document to see the risk assessment.</p>
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
                          className={`metric-bar ${getTrustScore(riskResult.score) >= 80 ? 'high' : getTrustScore(riskResult.score) >= 50 ? 'medium' : 'low'}`}
                          style={{ width: `${getTrustScore(riskResult.score)}%` }}
                        >
                          {getTrustScore(riskResult.score)}%
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
                          className={`metric-bar ${riskResult.score <= 30 ? 'high' : riskResult.score <= 60 ? 'medium' : 'low'}`}
                          style={{ width: `${riskResult.score}%` }}
                        >
                          {riskResult.score}%
                        </div>
                      </div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-label">Watchlist & Sanctions</div>
                      <div className="metric-bar-container">
                        <div 
                          className={`metric-bar ${riskResult.checks.find(c => c.label.toLowerCase().includes('watchlist') || c.label.toLowerCase().includes('unlisted'))?.status === 'ok' ? 'high' : riskResult.checks.find(c => c.label.toLowerCase().includes('watchlist') || c.label.toLowerCase().includes('unlisted'))?.status === 'warn' ? 'medium' : 'low'}`}
                          style={{ width: `${riskResult.checks.find(c => c.label.toLowerCase().includes('watchlist') || c.label.toLowerCase().includes('unlisted'))?.status === 'ok' ? 100 : riskResult.checks.find(c => c.label.toLowerCase().includes('watchlist') || c.label.toLowerCase().includes('unlisted'))?.status === 'warn' ? 50 : 0}%` }}
                        >
                          {riskResult.checks.find(c => c.label.toLowerCase().includes('watchlist') || c.label.toLowerCase().includes('unlisted'))?.status === 'ok' ? '100%' : riskResult.checks.find(c => c.label.toLowerCase().includes('watchlist') || c.label.toLowerCase().includes('unlisted'))?.status === 'warn' ? '50%' : '0%'}
                        </div>
                      </div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-label">Data Completeness</div>
                      <div className="metric-bar-container">
                        <div 
                          className={`metric-bar ${(() => {
                            if (!extracted) return 'low';
                            const fields = [extracted.businessName, extracted.registrationNo, extracted.address, extracted.entityType];
                            const filledFields = fields.filter(f => f && f.trim()).length;
                            const completeness = (filledFields / fields.length) * 100;
                            return completeness >= 80 ? 'high' : completeness >= 50 ? 'medium' : 'low';
                          })()}`}
                          style={{ width: `${(() => {
                            if (!extracted) return 0;
                            const fields = [extracted.businessName, extracted.registrationNo, extracted.address, extracted.entityType];
                            const filledFields = fields.filter(f => f && f.trim()).length;
                            return (filledFields / fields.length) * 100;
                          })()}%` }}
                        >
                          {(() => {
                            if (!extracted) return '0%';
                            const fields = [extracted.businessName, extracted.registrationNo, extracted.address, extracted.entityType];
                            const filledFields = fields.filter(f => f && f.trim()).length;
                            return `${Math.round((filledFields / fields.length) * 100)}%`;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-label">Verification Status</div>
                      <div className="metric-bar-container">
                        <div 
                          className={`metric-bar ${(() => {
                            if (!riskResult.checks || riskResult.checks.length === 0) return 'low';
                            const passedChecks = riskResult.checks.filter(c => c.status === 'ok').length;
                            const totalChecks = riskResult.checks.length;
                            const verificationRate = (passedChecks / totalChecks) * 100;
                            return verificationRate >= 80 ? 'high' : verificationRate >= 50 ? 'medium' : 'low';
                          })()}`}
                          style={{ width: `${(() => {
                            if (!riskResult.checks || riskResult.checks.length === 0) return 0;
                            const passedChecks = riskResult.checks.filter(c => c.status === 'ok').length;
                            const totalChecks = riskResult.checks.length;
                            return (passedChecks / totalChecks) * 100;
                          })()}%` }}
                        >
                          {(() => {
                            if (!riskResult.checks || riskResult.checks.length === 0) return '0%';
                            const passedChecks = riskResult.checks.filter(c => c.status === 'ok').length;
                            const totalChecks = riskResult.checks.length;
                            return `${Math.round((passedChecks / totalChecks) * 100)}%`;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="metric-item">
                      <div className="metric-label">Regulatory Compliance</div>
                      <div className="metric-bar-container">
                        <div 
                          className={`metric-bar ${(() => {
                            if (!extracted || !riskResult.checks) return 'low';
                            const regChecks = riskResult.checks.filter(c => 
                              c.label.toLowerCase().includes('registration') || 
                              c.label.toLowerCase().includes('address') ||
                              c.label.toLowerCase().includes('format')
                            );
                            if (regChecks.length === 0) return 'low';
                            const passedReg = regChecks.filter(c => c.status === 'ok').length;
                            const regRate = (passedReg / regChecks.length) * 100;
                            return regRate >= 80 ? 'high' : regRate >= 50 ? 'medium' : 'low';
                          })()}`}
                          style={{ width: `${(() => {
                            if (!extracted || !riskResult.checks) return 0;
                            const regChecks = riskResult.checks.filter(c => 
                              c.label.toLowerCase().includes('registration') || 
                              c.label.toLowerCase().includes('address') ||
                              c.label.toLowerCase().includes('format')
                            );
                            if (regChecks.length === 0) return 0;
                            const passedReg = regChecks.filter(c => c.status === 'ok').length;
                            return (passedReg / regChecks.length) * 100;
                          })()}%` }}
                        >
                          {(() => {
                            if (!extracted || !riskResult.checks) return '0%';
                            const regChecks = riskResult.checks.filter(c => 
                              c.label.toLowerCase().includes('registration') || 
                              c.label.toLowerCase().includes('address') ||
                              c.label.toLowerCase().includes('format')
                            );
                            if (regChecks.length === 0) return '0%';
                            const passedReg = regChecks.filter(c => c.status === 'ok').length;
                            return `${Math.round((passedReg / regChecks.length) * 100)}%`;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {privacyAnalysis && (
                  <div className="card">
                    <h4 className="compliance-section-title">🔒 Privacy & PII Analysis</h4>
                    <div className="privacy-analysis">
                      <div className={`privacy-status-badge ${privacyAnalysis.riskLevel}`}>
                        <span className="privacy-icon">
                          {privacyAnalysis.hasPII ? (privacyAnalysis.riskLevel === 'high' ? '🚨' : privacyAnalysis.riskLevel === 'medium' ? '⚠️' : '🔒') : '✅'}
                        </span>
                        <span className="privacy-status-text">
                          {privacyAnalysis.hasPII 
                            ? `PII Detected (${privacyAnalysis.riskLevel.toUpperCase()} Risk)`
                            : 'No PII Detected'}
                        </span>
                      </div>
                      
                      {privacyAnalysis.hasPII && (
                        <>
                          <div className="privacy-details">
                            <div className="privacy-detail-item">
                              <span className="privacy-detail-label">PII Instances:</span>
                              <span className="privacy-detail-value">{privacyAnalysis.piiCount}</span>
                            </div>
                            <div className="privacy-detail-item">
                              <span className="privacy-detail-label">Detected Types:</span>
                              <div className="privacy-types-list">
                                {privacyAnalysis.detectedTypes.map((type, idx) => (
                                  <span key={idx} className="privacy-type-badge">{type}</span>
                                ))}
                              </div>
                            </div>
                            {privacyAnalysis.fieldsWithPII && privacyAnalysis.fieldsWithPII.length > 0 && (
                              <div className="privacy-detail-item">
                                <span className="privacy-detail-label">Fields with PII:</span>
                                <div className="privacy-fields-list">
                                  {privacyAnalysis.fieldsWithPII.map((field, idx) => (
                                    <div key={idx} className="privacy-field-item">
                                      <span className="privacy-field-name">{field.field}</span>
                                      <span className="privacy-field-types">{field.types.join(', ')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="privacy-recommendations">
                            <h5 className="privacy-recommendations-title">Recommendations:</h5>
                            <ul className="privacy-recommendations-list">
                              {privacyAnalysis.recommendations.map((rec, idx) => (
                                <li key={idx}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

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

  const renderApprovedVendorsView = () => {
    return (
      <div className="history-view">
        <h2 className="page-title">Approved {entityType === 'client' ? 'Clients' : 'Vendors'}</h2>
        <div className="vendors-list">
          {approvedVendors.length === 0 ? (
            <div className="empty-state">No approved {entityType === 'client' ? 'clients' : 'vendors'} yet</div>
          ) : (
            approvedVendors.map((vendor) => (
              <div 
                key={vendor.id} 
                className="vendor-card clickable"
                onClick={() => setSelectedApprovedVendor(vendor)}
              >
                <div className="vendor-card-header">
                  <h3 className="vendor-card-name">{vendor.vendorName}</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className={`entity-type-badge ${vendor.entityType}`}>
                      {vendor.entityType === 'client' ? '👤 Client' : '🏢 Vendor'}
                    </div>
                    <div className={`vendor-status-badge approved`}>
                      Approved
                    </div>
                  </div>
                </div>
                <div className="vendor-card-details">
                    <div className="vendor-detail">
                    <span className="detail-icon">🏢</span>
                    <span>{vendor.extracted.businessName || 'N/A'}</span>
                    </div>
                    <div className="vendor-detail">
                      <span className="detail-icon">📍</span>
                    <span>{vendor.extracted.address || 'N/A'}</span>
                    </div>
                    <div className="vendor-detail">
                    <span className="detail-icon">📅</span>
                    <span>Approved: {new Date(vendor.approvedAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div className="vendor-card-footer">
                  <div className="vendor-risk-score">
                    <span className="risk-label">Risk:</span>
                    <span className={`risk-value ${vendor.riskResult.band.toLowerCase()}`}>
                      {vendor.riskResult.score}/100 ({vendor.riskResult.band})
                    </span>
                  </div>
                  <div className="vendor-trust-score">
                    <span className="trust-label">Trust:</span>
                    <div className="trust-mini-bar">
                      <div 
                        className="trust-mini-fill" 
                        style={{ width: `${getTrustScore(vendor.riskResult.score)}%` }}
                      />
                    </div>
                    <span className="trust-value">{getTrustScore(vendor.riskResult.score)}%</span>
                  </div>
                </div>
                <div className="vendor-lifecycle-indicator">
                  <span className="lifecycle-label">Lifecycle:</span>
                  <span className={`lifecycle-phase-badge ${vendor.lifecyclePhase}`} style={{ backgroundColor: getLifecyclePhaseColor(vendor.lifecyclePhase) }}>
                    {getLifecyclePhaseName(vendor.lifecyclePhase)}
                  </span>
                </div>
              </div>
            ))
          )}
                    </div>
      </div>
    )
  }

  const getLifecyclePhaseName = (phase: string) => {
    const phases: Record<string, string> = {
      'contract-negotiation': 'Contract Negotiation',
      'vendor-onboarding': 'Vendor Onboarding',
      'performance-management': 'Performance Management',
      'risk-compliance': 'Risk & Compliance',
      'reviewal': 'Reviewal',
      'extension-renewal': 'Extension/Renewal',
      'offboarding': 'Offboarding'
    }
    return phases[phase] || phase
  }

  const getLifecyclePhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      'contract-negotiation': '#3b82f6',
      'vendor-onboarding': '#10b981',
      'performance-management': '#f59e0b',
      'risk-compliance': '#ef4444',
      'reviewal': '#8b5cf6',
      'extension-renewal': '#06b6d4',
      'offboarding': '#6b7280'
    }
    return colors[phase] || '#6b7280'
  }

  const renderApprovedVendorDetailView = (vendor: typeof approvedVendors[0]) => {
    const lifecyclePhases = [
      { id: 'contract-negotiation', name: 'Contract Negotiation and Signing', description: 'Define legal, financial, and performance terms. Establish framework for operations and success measurement.', color: '#3b82f6' },
      { id: 'vendor-onboarding', name: 'Vendor Onboarding', description: 'Integrate vendor into company systems. Collect essential information, create profiles, provide access.', color: '#10b981' },
      { id: 'performance-management', name: 'Performance Management', description: 'Evaluate vendor delivery on agreed expectations. Track KPIs, conduct reviews, implement improvements.', color: '#f59e0b' },
      { id: 'risk-compliance', name: 'Risk and Compliance Monitoring', description: 'Continuous review of financial stability, security, and compliance. Periodic risk assessments.', color: '#ef4444' },
      { id: 'reviewal', name: 'Reviewal (Contract Evaluation)', description: 'Formal review of performance, cost-benefit, and compliance before renewal/termination decision.', color: '#8b5cf6' },
      { id: 'extension-renewal', name: 'Extension or Renewal', description: 'Renew or extend contract with updated terms based on performance and new business needs.', color: '#06b6d4' },
      { id: 'offboarding', name: 'Offboarding (Termination)', description: 'Secure separation: complete deliverables, terminate access, retrieve data, archive records.', color: '#6b7280' }
    ]

    const currentPhaseIndex = lifecyclePhases.findIndex(p => p.id === vendor.lifecyclePhase)

    return (
      <div className="vendor-detail-view">
        <div className="vendor-detail-header">
          <button className="back-button" onClick={() => setSelectedApprovedVendor(null)}>
            ← Back to Approved {vendor.entityType === 'client' ? 'Clients' : 'Vendors'}
          </button>
          <div className="vendor-detail-title">
            <h2 className="page-title">{vendor.vendorName}</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className={`entity-type-badge ${vendor.entityType}`}>
                {vendor.entityType === 'client' ? '👤 Client' : '🏢 Vendor'}
              </div>
              <div className={`vendor-status-badge approved`}>
                Approved
              </div>
            </div>
          </div>
        </div>

        <div className="vendor-detail-content">
          <div className="card">
            <h3 className="section-title">{vendor.entityType === 'client' ? 'Client' : 'Vendor'} Information</h3>
            <div className="vendor-info-grid">
              <div className="info-item">
                <span className="info-label">Business Name:</span>
                <span className="info-value">{vendor.extracted.businessName || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Registration No:</span>
                <span className="info-value">{vendor.extracted.registrationNo || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Address:</span>
                <span className="info-value">{vendor.extracted.address || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Entity Type:</span>
                <span className="info-value">{vendor.extracted.entityType || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Trust Score:</span>
                <span className="info-value">{getTrustScore(vendor.riskResult.score)}%</span>
              </div>
              <div className="info-item">
                <span className="info-label">Risk Score:</span>
                <span className={`info-value ${vendor.riskResult.band.toLowerCase()}`}>
                  {vendor.riskResult.score}/100 ({vendor.riskResult.band})
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Lifecycle Management</h3>
            <div className="lifecycle-phases">
              {lifecyclePhases.map((phase, index) => {
                const isActive = vendor.lifecyclePhase === phase.id
                
                return (
                  <div 
                    key={phase.id} 
                    className={`lifecycle-phase ${isActive ? 'active' : ''}`}
                    style={{ borderLeftColor: phase.color, borderLeftWidth: '4px', borderLeftStyle: 'solid' }}
                  >
                    <div className="phase-header">
                      <div className="phase-number" style={{ backgroundColor: phase.color }}>
                        {index + 1}
                      </div>
                      <div className="phase-info">
                        <div className="phase-name">{phase.name}</div>
                        <div className="phase-description">{phase.description}</div>
                      </div>
                      {isActive && <div className="phase-badge active" style={{ backgroundColor: phase.color }}>Current</div>}
                    </div>
                    <div className="phase-actions">
                      {!isActive ? (
                        <button 
                          className="btn-secondary"
                          onClick={() => {
                            // If offboarding, remove from approved list
                            if (phase.id === 'offboarding') {
                              setApprovedVendors(approvedVendors.filter(v => v.id !== vendor.id))
                              setSelectedApprovedVendor(null)
                              console.log(`✅ ${vendor.vendorName} has been offboarded and removed from approved list`)
                            } else {
                              // Otherwise, just update the phase
                              setApprovedVendors(approvedVendors.map(v => 
                                v.id === vendor.id 
                                  ? { ...v, lifecyclePhase: phase.id }
                                  : v
                              ))
                              setSelectedApprovedVendor({
                                ...vendor,
                                lifecyclePhase: phase.id
                              })
                            }
                          }}
                        >
                          Set to {phase.name}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {phase.id === 'offboarding' ? (
                            <button 
                              className="btn-danger"
                              onClick={() => {
                                setApprovedVendors(approvedVendors.filter(v => v.id !== vendor.id))
                                setSelectedApprovedVendor(null)
                                console.log(`✅ ${vendor.vendorName} has been offboarded and removed from approved list`)
                              }}
                            >
                              Complete Offboarding & Remove
                            </button>
                          ) : (
                            <span className="current-phase-indicator" style={{ color: phase.color, fontWeight: 600 }}>
                              Currently in this phase
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderFlaggedVendorsView = () => {
    return (
      <div className="history-view">
        <h2 className="page-title">Flagged {entityType === 'client' ? 'Clients' : 'Vendors'}</h2>
        <div className="vendors-list">
          {flaggedVendors.length === 0 ? (
            <div className="empty-state">No flagged {entityType === 'client' ? 'clients' : 'vendors'} yet</div>
          ) : (
            flaggedVendors.map((vendor) => (
              <div 
                key={vendor.id} 
                className="vendor-card"
              >
                <div className="vendor-card-header">
                  <h3 className="vendor-card-name">{vendor.vendorName}</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className={`entity-type-badge ${vendor.entityType}`}>
                      {vendor.entityType === 'client' ? '👤 Client' : '🏢 Vendor'}
                    </div>
                    <div className={`vendor-status-badge flagged`}>
                      🚩 Flagged
                    </div>
                  </div>
                </div>
                <div className="vendor-card-details">
                  <div className="vendor-detail">
                    <span className="detail-icon">🏢</span>
                    <span>{vendor.extracted.businessName || 'N/A'}</span>
                  </div>
                  <div className="vendor-detail">
                    <span className="detail-icon">📍</span>
                    <span>{vendor.extracted.address || 'N/A'}</span>
                  </div>
                  <div className="vendor-detail">
                    <span className="detail-icon">📅</span>
                    <span>Flagged: {new Date(vendor.flaggedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="vendor-card-footer">
                  <div className="vendor-risk-score">
                    <span className="risk-label">Risk:</span>
                    <span className={`risk-value ${vendor.riskResult.band.toLowerCase()}`}>
                      {vendor.riskResult.score}/100 ({vendor.riskResult.band})
                    </span>
                  </div>
                  <div className="vendor-trust-score">
                    <span className="trust-label">Trust:</span>
                    <div className="trust-mini-bar">
                      <div 
                        className="trust-mini-fill" 
                        style={{ width: `${getTrustScore(vendor.riskResult.score)}%` }}
                      />
                    </div>
                    <span className="trust-value">{getTrustScore(vendor.riskResult.score)}%</span>
                  </div>
                </div>
                <div className="flagged-vendor-actions">
                  <button 
                    className="btn-remove"
                    onClick={() => setFlaggedVendors(flaggedVendors.filter(v => v.id !== vendor.id))}
                  >
                    Remove from Flagged
                  </button>
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
                <span className="info-label">Trust Score:</span>
                <span className="info-value">{getTrustScore(vendor.risk)}%</span>
              </div>
              <div className="info-item">
                <span className="info-label">Risk Score:</span>
                <span className={`info-value ${vendor.risk && vendor.risk >= 80 ? 'low' : vendor.risk && vendor.risk >= 50 ? 'medium' : 'high'}`}>
                  {vendor.risk || 'N/A'}
                </span>
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

  const renderComplianceView = () => {
    const totalVendors = vendors.length + approvedVendors.length + flaggedVendors.length
    const compliantCount = approvedVendors.length
    const flaggedCount = flaggedVendors.length
    const underReviewCount = vendors.filter(v => (v.risk || 0) >= 50 && (v.risk || 0) < 80).length
    const nonCompliantCount = flaggedVendors.length + vendors.filter(v => (v.risk || 0) < 50).length
    const complianceRate = totalVendors > 0 ? Math.round((compliantCount / totalVendors) * 100) : 0

    return (
      <div className="compliance-view">
        <div className="compliance-header-section">
          <div>
            <h2 className="page-title">Compliance Dashboard</h2>
            <p className="compliance-subtitle">Monitor and manage vendor compliance across all entities</p>
          </div>
          <div className={`compliance-badge-large ${complianceRate >= 80 ? 'compliant' : complianceRate >= 50 ? 'review' : 'non-compliant'}`}>
            {complianceRate}% Compliance Rate
          </div>
        </div>

        <div className="compliance-overview">
          <div className="card">
            <h3 className="section-title">📊 Overall Compliance Status</h3>
            <div className="compliance-stats">
              <div className="stat-card stat-card-primary">
                <div className="stat-icon">✅</div>
                <div className="stat-value">{compliantCount}</div>
                <div className="stat-label">Approved & Compliant</div>
                <div className="stat-trend">+{approvedVendors.length} this session</div>
              </div>
              <div className="stat-card stat-card-warning">
                <div className="stat-icon">⏳</div>
                <div className="stat-value">{underReviewCount}</div>
                <div className="stat-label">Under Review</div>
                <div className="stat-trend">Pending assessment</div>
              </div>
              <div className="stat-card stat-card-danger">
                <div className="stat-icon">🚩</div>
                <div className="stat-value">{flaggedCount}</div>
                <div className="stat-label">Flagged Vendors</div>
                <div className="stat-trend">Requires attention</div>
              </div>
              <div className="stat-card stat-card-info">
                <div className="stat-icon">📋</div>
                <div className="stat-value">{totalVendors}</div>
                <div className="stat-label">Total Entities</div>
                <div className="stat-trend">{approvedVendors.length} approved, {flaggedVendors.length} flagged</div>
              </div>
            </div>
          </div>

          <div className="compliance-grid">
            <div className="card">
              <h3 className="section-title">✅ Compliance Requirements</h3>
              <div className="requirements-overview">
                <div className="requirement-overview-item requirement-passed">
                  <div className="req-icon-wrapper">
                    <span className="req-icon">✓</span>
                  </div>
                  <div className="req-content">
                    <span className="req-text">Business Registration Verification</span>
                    <span className="req-status-badge passed">Active</span>
                  </div>
                </div>
                <div className="requirement-overview-item requirement-passed">
                  <div className="req-icon-wrapper">
                    <span className="req-icon">✓</span>
                  </div>
                  <div className="req-content">
                    <span className="req-text">Address Validation</span>
                    <span className="req-status-badge passed">Active</span>
                  </div>
                </div>
                <div className="requirement-overview-item requirement-passed">
                  <div className="req-icon-wrapper">
                    <span className="req-icon">✓</span>
                  </div>
                  <div className="req-content">
                    <span className="req-text">Sanctions & Watchlist Screening</span>
                    <span className="req-status-badge passed">Active</span>
                  </div>
                </div>
                <div className="requirement-overview-item requirement-pending">
                  <div className="req-icon-wrapper">
                    <span className="req-icon">⏳</span>
                  </div>
                  <div className="req-content">
                    <span className="req-text">Financial History Review</span>
                    <span className="req-status-badge pending">Pending</span>
                  </div>
                </div>
                <div className="requirement-overview-item requirement-passed">
                  <div className="req-icon-wrapper">
                    <span className="req-icon">✓</span>
                  </div>
                  <div className="req-content">
                    <span className="req-text">AI-Powered Risk Assessment</span>
                    <span className="req-status-badge passed">Active</span>
                  </div>
                </div>
                <div className="requirement-overview-item requirement-passed">
                  <div className="req-icon-wrapper">
                    <span className="req-icon">✓</span>
                  </div>
                  <div className="req-content">
                    <span className="req-text">Documentation Verification</span>
                    <span className="req-status-badge passed">Active</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="section-title">📈 Compliance Metrics</h3>
              <div className="compliance-metrics-summary">
                <div className="metric-summary-item">
                  <div className="metric-summary-label">Average Trust Score</div>
                  <div className="metric-summary-value">
                    {approvedVendors.length > 0 
                      ? Math.round(approvedVendors.reduce((sum, v) => sum + getTrustScore(v.riskResult.score), 0) / approvedVendors.length)
                      : 'N/A'}%
                  </div>
                  <div className="metric-summary-bar">
                    <div 
                      className="metric-summary-fill" 
                      style={{ 
                        width: `${approvedVendors.length > 0 
                          ? approvedVendors.reduce((sum, v) => sum + getTrustScore(v.riskResult.score), 0) / approvedVendors.length
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
                <div className="metric-summary-item">
                  <div className="metric-summary-label">Average Risk Score</div>
                  <div className="metric-summary-value">
                    {approvedVendors.length > 0 
                      ? Math.round(approvedVendors.reduce((sum, v) => sum + v.riskResult.score, 0) / approvedVendors.length)
                      : 'N/A'}/100
                  </div>
                  <div className="metric-summary-bar">
                    <div 
                      className="metric-summary-fill risk" 
                      style={{ 
                        width: `${approvedVendors.length > 0 
                          ? approvedVendors.reduce((sum, v) => sum + v.riskResult.score, 0) / approvedVendors.length
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
                <div className="metric-summary-item">
                  <div className="metric-summary-label">Entities Processed Today</div>
                  <div className="metric-summary-value">{activities.filter(a => a.type === 'upload').length}</div>
                </div>
                <div className="metric-summary-item">
                  <div className="metric-summary-label">Risk Assessments Completed</div>
                  <div className="metric-summary-value">{activities.filter(a => a.type === 'score').length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">🕒 Recent Compliance Activities</h3>
            <div className="compliance-activities">
              {activities
                .filter(a => a.type === 'score' || a.type === 'extract' || a.type === 'upload')
                .slice(0, 15)
                .map((activity, idx) => (
                  <div key={activity.id || activity.at || activity.t || idx} className="compliance-activity-item">
                    <div className="activity-indicator" />
                    <div className="activity-content">
                      <div className="activity-time-small">
                        {new Date(activity.at || activity.t || Date.now()).toLocaleString()}
                      </div>
                      <div className="activity-description">
                        {formatActivityMessage(activity)}
                      </div>
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
  }

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside 
        className={`sidebar ${sidebarExpanded ? 'expanded' : ''}`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div 
          className="sidebar-logo"
          onClick={() => {
            // Full reset - clear all state
            setCurrentView('home')
            setSelectedVendor(null)
            setSelectedApprovedVendor(null)
            setActiveTab('Draft')
            setUploadedFile(null)
            setExtracted(null)
            setRiskResult(null)
            setError(null)
            setVendorName('AI Manager')
            setEntityType('vendor')
            // Reset file input
            const fileInput = document.getElementById('file-upload') as HTMLInputElement
            if (fileInput) {
              fileInput.value = ''
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <img 
            src="/gs-logo.png" 
            alt="Goldman Sachs" 
            className="logo-image"
            onError={(e) => {
              // Fallback to text if image doesn't load
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <span className="logo-text" style={{ display: 'none' }}>GS</span>
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
            className={`nav-item ${currentView === 'approved' ? 'active' : ''}`}
            onClick={() => { setCurrentView('approved'); setSelectedApprovedVendor(null); }}
          >
            <span className="nav-icon">✅</span>
            {sidebarExpanded && <span className="nav-label">Approved {entityType === 'client' ? 'Clients' : 'Vendors'}</span>}
          </div>
          <div 
            className={`nav-item ${currentView === 'flagged' ? 'active' : ''}`}
            onClick={() => { setCurrentView('flagged'); setSelectedVendor(null); }}
          >
            <span className="nav-icon">🚩</span>
            {sidebarExpanded && <span className="nav-label">Flagged {entityType === 'client' ? 'Clients' : 'Vendors'}</span>}
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
            {currentView === 'approved' && (selectedApprovedVendor ? renderApprovedVendorDetailView(selectedApprovedVendor) : renderApprovedVendorsView())}
            {currentView === 'flagged' && renderFlaggedVendorsView()}
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
                    <div className="risk-score-label-above">Risk Score</div>
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
                    ? 'Upload a document to see risk assessment'
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
