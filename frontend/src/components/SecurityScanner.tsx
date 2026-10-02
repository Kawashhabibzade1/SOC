'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, Bug } from 'lucide-react';

interface Vulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
  Severity: string;
  Title: string;
}

interface ScanResult {
  Target: string;
  Vulnerabilities: Vulnerability[];
}

export default function SecurityScanner() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = async () => {
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || `http://${window.location.hostname}:3001`;
      const res = await fetch(`${GATEWAY_URL}/api/security/cve`);
      const data = await res.json();
      if (data.success && data.data && data.data.Results) {
        setResults(data.data.Results);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchResults();
    const int = setInterval(fetchResults, 10000); // Check every 10s for new scan results
    return () => clearInterval(int);
  }, []);

  const triggerScan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || `http://${window.location.hostname}:3001`;
      await fetch(`${GATEWAY_URL}/api/security/scan`, { method: 'POST' });
      // It runs in the background. We just wait for the interval to pick up results.
      setTimeout(() => setIsScanning(false), 30000); // Reset UI after 30s
    } catch (err) {
      setError('Failed to trigger scan.');
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020817] rounded-xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-fuchsia-400" />
          <h2 className="text-fuchsia-400 font-orbitron tracking-widest text-lg font-bold">CVE Scanner</h2>
        </div>
        <button
          onClick={triggerScan}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-mono text-xs uppercase disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning (Trivy)...' : 'Run Full Scan'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 font-mono text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto space-y-6">
        {results.length === 0 ? (
          <div className="text-center text-slate-500 p-8 font-mono text-sm">
            No vulnerabilities found, or no scan has been run yet.
          </div>
        ) : (
          results.map((target, tIdx) => (
            <div key={tIdx} className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
              <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-300 font-bold">{target.Target}</span>
                <span className="font-mono text-[10px] text-fuchsia-400 bg-fuchsia-400/10 px-2 py-1 rounded">
                  {target.Vulnerabilities ? target.Vulnerabilities.length : 0} Issues
                </span>
              </div>
              <div className="p-4 space-y-3">
                {target.Vulnerabilities ? (
                  target.Vulnerabilities.map((vuln, vIdx) => (
                    <div key={vIdx} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-950/50 rounded border border-slate-800/50 hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2 sm:w-32 flex-shrink-0">
                        {vuln.Severity === 'CRITICAL' || vuln.Severity === 'HIGH' ? (
                          <ShieldAlert className="w-4 h-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className={`font-mono text-xs font-bold ${vuln.Severity === 'CRITICAL' ? 'text-red-500' : vuln.Severity === 'HIGH' ? 'text-orange-500' : 'text-yellow-500'}`}>
                          {vuln.Severity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-slate-200 truncate font-bold">
                          {vuln.VulnerabilityID}: {vuln.PkgName}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 truncate" title={vuln.Title}>
                          {vuln.Title || 'No title available'}
                        </div>
                      </div>
                      <div className="flex flex-col font-mono text-[10px] sm:text-right gap-1">
                        <span className="text-slate-400">Current: <span className="text-slate-300">{vuln.InstalledVersion}</span></span>
                        {vuln.FixedVersion && (
                          <span className="text-emerald-400">Fix: {vuln.FixedVersion}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-emerald-400 font-mono text-xs p-2">✓ Target is clean</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
