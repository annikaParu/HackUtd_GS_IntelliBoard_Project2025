import { useState } from 'react';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">
              GS
            </div>
            {sidebarOpen && <span className="font-bold text-lg">IntelliBoard</span>}
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <a href="#" className="flex items-center gap-3 p-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors">
            <span className="text-xl">🏠</span>
            {sidebarOpen && <span>Home</span>}
          </a>
          <a href="#" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <span className="text-xl">📊</span>
            {sidebarOpen && <span>Analytics</span>}
          </a>
          <a href="#" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <span className="text-xl">⚙️</span>
            {sidebarOpen && <span>Settings</span>}
          </a>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              👤
            </div>
            {sidebarOpen && <span>User</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IntelliBoard</h1>
            <p className="text-sm text-gray-600">Smarter Vendor Onboarding. Transparent Risk. Instant Trust.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Prototype @ HackUTD 2025</span>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-xl">☰</span>
            </button>
          </div>
        </header>

        {/* Curved Blue Gradient Hero Section */}
        <div className="relative bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 px-6 py-12 overflow-hidden">
          {/* Wavy bottom border */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
              <path d="M0,60 Q360,0 720,60 T1440,60 L1440,120 L0,120 Z" fill="white" />
            </svg>
          </div>
          
          {/* Star decorations */}
          <div className="absolute inset-0 overflow-hidden">
            <span className="absolute top-1/4 left-1/4 text-white text-xl opacity-60 animate-pulse">✦</span>
            <span className="absolute top-1/3 right-1/3 text-white text-lg opacity-50 animate-pulse delay-300">✦</span>
            <span className="absolute bottom-1/4 left-1/2 text-white text-xl opacity-60 animate-pulse delay-700">✦</span>
            <span className="absolute top-1/2 right-1/4 text-white text-lg opacity-50 animate-pulse delay-1000">✦</span>
          </div>
          
          {/* Hero Content */}
          <div className="relative z-10 max-w-4xl">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl max-w-md ml-auto">
              <p className="text-gray-700 font-medium">Upload a document and click Approve to see risk assessment</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Vendor Header */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Acme Technologies Inc</h2>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Smarter Trust
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg">⋯</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-gray-200 mb-6">
              <button className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-colors">
                Draft
              </button>
              <button className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-colors">
                AI Review
              </button>
              <button className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-colors">
                Compliance Check
              </button>
              <button className="px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Approved
              </button>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Approval Status Card */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Approval Status</h3>
                <p className="text-gray-600 mb-4">The vendor passed all checks. Instant Trust status granted.</p>
                <div className="flex justify-end">
                  <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl text-teal-600">✓</span>
                  </div>
                </div>
              </div>

              {/* AI Risk Assessment Card */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <h3 className="text-lg font-bold text-gray-900 mb-4">AI Risk Assessment</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-teal-600 text-xl">✓</span>
                    <span className="text-gray-700">Vendor is unlisted in watchlists</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-teal-600 text-xl">✓</span>
                    <span className="text-gray-700">Financial history unavailable</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Log Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Activity Log</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="text-gray-400">17:14:08 AM</span>
                  <span>init: {"{"}"message":"System initialized"{"}"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
