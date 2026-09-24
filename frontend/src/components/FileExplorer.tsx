import React, { useEffect, useState } from 'react';
import { 
  Folder, File as FileIcon, FileText, Image as ImageIcon, 
  Trash2, Download, Upload, FolderPlus, ArrowLeft, RefreshCw, 
  Terminal, Music, Video, Archive, HardDrive, Lock, KeyRound, X as CloseIcon
} from 'lucide-react';

interface FileExplorerProps {
  initialPath: string;
}

interface FSItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: string;
  error?: boolean;
}

export default function FileExplorer({ initialPath }: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || 'SAMBA');
  const [items, setItems] = useState<FSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Samba state
  const [sambaUsers, setSambaUsers] = useState<string[]>([]);
  const [sambaShares, setSambaShares] = useState<any[]>([]);

  // Auth State
  const [authModalUser, setAuthModalUser] = useState<string | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Modals / Prompts
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (initialPath && initialPath !== currentPath) {
      setCurrentPath(initialPath);
      fetchDir(initialPath);
    }
  }, [initialPath]);

  const fetchDir = async (dir: string) => {
    setLoading(true);
    setError('');
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      
      if (dir === 'SAMBA' || dir.startsWith('SAMBA:')) {
        const res = await fetch(`${GATEWAY_URL}/api/samba/shares`);
        const json = await res.json();
        if (json.success) {
          const shares = json.data;
          setSambaShares(shares);
          
          if (dir === 'SAMBA') {
            // Extract unique users
            const users = new Set<string>();
            shares.forEach((s: any) => s.users.forEach((u: string) => users.add(u)));
            setSambaUsers(Array.from(users));
            setItems([]);
          } else {
            // "SAMBA:kawash"
            const user = dir.split(':')[1];
            const userShares = shares.filter((s: any) => s.users.includes(user));
            // map shares to FSItem
            setItems(userShares.map((s: any) => ({
              name: s.name,
              path: s.path,
              isDirectory: true,
              size: 0,
              mtime: '',
              isShare: true // custom flag
            })));
          }
          setCurrentPath(dir);
        } else {
          setError(json.error || 'Failed to list Samba shares');
        }
      } else {
        const res = await fetch(`${GATEWAY_URL}/api/fs/list?path=${encodeURIComponent(dir)}`);
        const json = await res.json();
        if (json.success) {
          setItems(json.data);
          setCurrentPath(dir);
        } else {
          setError(json.error || 'Failed to list directory');
        }
      }
    } catch (err) {
      setError('Network error reading directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDir(currentPath);
  }, []);

  const navigateTo = (newPath: string) => {
    fetchDir(newPath);
  };

  const navigateUp = () => {
    if (currentPath === 'SAMBA') return;
    if (currentPath.startsWith('SAMBA:')) {
      fetchDir('SAMBA');
      return;
    }
    
    // If it's a real path
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      fetchDir('SAMBA'); // Default back to Samba selection when reaching root
      return;
    }
    parts.pop();
    const parent = '/' + parts.join('/');
    fetchDir(parent);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return <Folder className="w-5 h-5 text-blue-400" />;
    const ext = name.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': 
        return <ImageIcon className="w-5 h-5 text-purple-400" />;
      case 'txt': case 'md': case 'csv': case 'json': case 'js': case 'ts': case 'tsx':
        return <FileText className="w-5 h-5 text-slate-400" />;
      case 'mp4': case 'mkv': case 'avi':
        return <Video className="w-5 h-5 text-pink-400" />;
      case 'mp3': case 'wav':
        return <Music className="w-5 h-5 text-yellow-400" />;
      case 'zip': case 'tar': case 'gz': case 'rar':
        return <Archive className="w-5 h-5 text-orange-400" />;
      case 'sh': case 'bat':
        return <Terminal className="w-5 h-5 text-cyber-green" />;
      default:
        return <FileIcon className="w-5 h-5 text-slate-500" />;
    }
  };

  const handleDownload = (item: FSItem) => {
    const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
    window.open(`${GATEWAY_URL}/api/fs/download?path=${encodeURIComponent(item.path)}`, '_blank');
  };

  const handleDelete = async (item: FSItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/fs/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', source: item.path })
      });
      const json = await res.json();
      if (json.success) fetchDir(currentPath);
      else alert(`Delete failed: ${json.error}`);
    } catch (err) {
      alert('Delete failed due to network error');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetPath', currentPath);

    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/fs/upload`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        fetchDir(currentPath);
      } else {
        alert(`Upload failed: ${json.error}`);
      }
    } catch (err) {
      alert('Upload failed due to network error');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // reset input
    }
  };

  const handleMkdir = async () => {
    const name = prompt('Enter new folder name:');
    if (!name) return;
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/fs/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mkdir', source: `${currentPath}/${name}`.replace('//', '/') })
      });
      const json = await res.json();
      if (json.success) fetchDir(currentPath);
      else alert(`Create folder failed: ${json.error}`);
    } catch (err) {
      alert('Create folder failed due to network error');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
      const res = await fetch(`${GATEWAY_URL}/api/samba/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authModalUser, password: authPassword })
      });
      const json = await res.json();
      if (json.success) {
        navigateTo(`SAMBA:${authModalUser}`);
        setAuthModalUser(null);
        setAuthPassword('');
      } else {
        setAuthError(json.error || 'Invalid password');
      }
    } catch (err) {
      setAuthError('Network error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 relative">
      {/* Auth Modal */}
      {authModalUser && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md rounded-xl">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>
            
            <button 
              onClick={() => { setAuthModalUser(null); setAuthError(''); setAuthPassword(''); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 border border-blue-500/20">
                <Lock className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-orbitron font-bold text-slate-200">AUTHENTICATE</h3>
              <p className="text-sm text-slate-400 font-mono mt-1">User: <span className="text-cyan-400 font-bold">{authModalUser}</span></p>
            </div>
            
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="w-4 h-4 text-slate-500" />
                </div>
                <input 
                  type="password" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Samba Password" 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono placeholder:text-slate-600"
                  autoFocus
                />
              </div>
              
              {authError && (
                <div className="text-red-400 text-xs font-mono bg-red-950/50 border border-red-900/50 p-2 rounded text-center animate-shake">
                  {authError}
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isAuthenticating || !authPassword}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-3 rounded-xl transition-all mt-2"
              >
                {isAuthenticating ? 'VERIFYING...' : 'UNLOCK'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between gap-4 overflow-x-auto shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={navigateUp}
            disabled={currentPath === 'SAMBA'}
            className="p-2 bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-slate-700"
            title="Up Directory"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          
          <div className="flex items-center bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2 font-mono text-sm text-slate-300 min-w-[200px] overflow-hidden whitespace-nowrap">
            <HardDrive className="w-4 h-4 text-cyber-cyan mr-3 shrink-0" />
            <span className="truncate">
              {currentPath === 'SAMBA' ? 'Network Shares' : currentPath.startsWith('SAMBA:') ? `Shares for ${currentPath.split(':')[1]}` : currentPath}
            </span>
          </div>

          <button onClick={() => fetchDir(currentPath)} className="p-2 bg-slate-800/50 hover:bg-cyber-cyan/20 rounded-lg transition-colors border border-slate-700 group">
            <RefreshCw className={`w-5 h-5 text-slate-300 group-hover:text-cyber-cyan ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!currentPath.startsWith('SAMBA') && (
          <div className="flex items-center gap-2">
            <button onClick={handleMkdir} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-700">
              <FolderPlus className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
            
            <label className={`flex items-center gap-2 px-3 py-2 ${isUploading ? 'bg-cyber-cyan/50' : 'bg-cyber-cyan/20 hover:bg-cyber-cyan/30'} border border-cyber-cyan/30 text-cyber-cyan rounded-lg text-sm font-bold cursor-pointer transition-colors`}>
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload File'}</span>
              <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} />
            </label>
          </div>
        )}
      </div>

      {/* Main List */}
      <div className="glass-panel rounded-xl flex-1 overflow-hidden flex flex-col relative">
        {loading && items.length === 0 && sambaUsers.length === 0 && (
          <div className="absolute inset-0 z-10 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-cyber-cyan animate-spin" />
          </div>
        )}

        {error ? (
          <div className="p-8 text-center text-red-400 font-mono text-sm uppercase">{error}</div>
        ) : (
          <div className="overflow-auto flex-1 p-2 flex flex-col">
            {currentPath === 'SAMBA' ? (
              <div className="p-8 h-full flex flex-col items-center justify-center gap-6">
                <h2 className="text-xl font-orbitron font-bold text-slate-200 tracking-widest">SELECT USER CONTEXT</h2>
                <div className="flex flex-wrap gap-4 justify-center">
                  {sambaUsers.map(user => (
                    <button 
                      key={user}
                      onClick={() => setAuthModalUser(user)}
                      className="px-6 py-4 bg-slate-800/80 hover:bg-cyber-cyan/20 border border-slate-700 hover:border-cyber-cyan/50 rounded-xl flex flex-col items-center gap-3 transition-all min-w-[150px]"
                    >
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 border border-blue-500/30">
                        {user.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-300">{user}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-orbitron tracking-widest text-slate-500 uppercase">
                  <th className="font-medium px-4 py-3">Name</th>
                  <th className="font-medium px-4 py-3 hidden sm:table-cell">Size</th>
                  <th className="font-medium px-4 py-3 hidden md:table-cell">Modified</th>
                  <th className="font-medium px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500 font-mono text-xs uppercase tracking-widest">
                      Directory is Empty
                    </td>
                  </tr>
                )}
                {items.map((item, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    onDoubleClick={() => item.isDirectory ? navigateTo(item.path) : null}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {getFileIcon(item.name, item.isDirectory)}
                        <span 
                          className={`font-medium text-sm truncate max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg ${item.isDirectory ? 'text-blue-300 hover:underline cursor-pointer' : 'text-slate-200'}`}
                          onClick={() => item.isDirectory ? navigateTo(item.path) : null}
                          title={item.name}
                        >
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono hidden sm:table-cell">
                      {item.isDirectory ? '--' : formatBytes(item.size)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono hidden md:table-cell">
                      {item.mtime ? new Date(item.mtime).toLocaleString() : '--'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!item.isDirectory && (
                          <button onClick={(e) => { e.stopPropagation(); handleDownload(item); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-cyber-cyan transition-colors" title="Download">
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="p-1.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
