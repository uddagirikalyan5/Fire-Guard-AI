import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Lock, User, Eye, EyeOff, CheckCircle2, ArrowRight,
  Sparkles, Terminal, UserPlus, LogIn, Building, Shield, AlertCircle,
  Phone, Mail, Send, DoorOpen, Trash2
} from 'lucide-react';
import { User as UserType, UserRole } from '../types';
import { soundAlarm } from '../utils/audioAlarm';

interface LoginScreenProps {
  onLogin: (user: UserType) => void;
}

interface StoredAccount extends UserType {
  passwordHash: string;
}

const DEFAULT_ACCOUNTS: StoredAccount[] = [];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [activeMode, setActiveMode] = useState<'login' | 'register'>('login');

  // Login Form States (empty by default - no default credentials)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form States
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobileNumber, setRegMobileNumber] = useState('');
  const [regRoomName, setRegRoomName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('user');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Registered accounts stored in localStorage with default accounts purged and deduplicated
  const [accounts, setAccounts] = useState<StoredAccount[]>(() => {
    try {
      const saved = localStorage.getItem('fireguard_registered_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Explicitly filter out any old default dummy accounts and deduplicate by username
          const seenUsernames = new Set<string>();
          const userCreated = parsed.filter(
            (acc: any) =>
              acc.id !== 'usr-admin' &&
              acc.id !== 'usr-user' &&
              acc.id !== 'usr-safety'
          ).filter((acc: any) => {
            const u = (acc.username || '').trim().toLowerCase();
            if (!u || seenUsernames.has(u)) return false;
            seenUsernames.add(u);
            return true;
          });

          return userCreated.map((acc: any) => ({
            ...acc,
            role: acc.role === 'admin' ? 'admin' : 'user',
            roomName: acc.roomName || acc.department || 'Central Command Center',
            department: acc.roomName || acc.department || 'Central Command Center',
            mobileNumber: acc.mobileNumber || '',
            email: acc.email || `${acc.username || 'user'}@fireguard.ai`
          }));
        }
      }
    } catch (e) {
      console.error('Error loading accounts from localStorage', e);
    }
    return DEFAULT_ACCOUNTS;
  });

  useEffect(() => {
    localStorage.setItem('fireguard_registered_users', JSON.stringify(accounts));
  }, [accounts]);

  // Handle Login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const trimmedUser = loginUsername.trim().toLowerCase();
      const account = accounts.find(
        (a) => a.username.toLowerCase() === trimmedUser && a.passwordHash === loginPassword
      );

      if (account) {
        soundAlarm.playBeep(880, 0.08);
        onLogin({
          id: account.id,
          username: account.username,
          role: account.role === 'admin' ? 'admin' : 'user',
          fullName: account.fullName,
          roomName: account.roomName || account.department || 'Central Command Center',
          department: account.roomName || account.department || 'Central Command Center',
          mobileNumber: account.mobileNumber || '',
          email: account.email || `${account.username}@fireguard.ai`,
          createdAt: account.createdAt
        });
      } else {
        setErrorMsg('Invalid credentials. No registered operator found matching this username and password. Please register an account first.');
        setIsLoading(false);
        soundAlarm.playBeep(300, 0.15);
      }
    }, 350);
  };

  const handleDeleteAccount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    localStorage.setItem('fireguard_registered_users', JSON.stringify(updated));
  };

  // Handle Register submission
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!regFullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('A valid Email ID is required.');
      return;
    }
    if (!regMobileNumber.trim() || regMobileNumber.trim().length < 6) {
      setErrorMsg('Mobile number is required for Telegram notifications.');
      return;
    }
    if (!regRoomName.trim()) {
      setErrorMsg('Please enter your Room Name (free text).');
      return;
    }
    const cleanUser = regUsername.trim().toLowerCase();
    if (cleanUser.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }
    if (accounts.some((a) => a.username.toLowerCase() === cleanUser)) {
      setErrorMsg(`Username "${cleanUser}" is already registered. Please choose another.`);
      return;
    }
    if (regPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const newAccount: StoredAccount = {
        id: `usr-${Date.now()}`,
        username: cleanUser,
        passwordHash: regPassword,
        fullName: regFullName.trim(),
        role: regRole === 'admin' ? 'admin' : 'user',
        roomName: regRoomName.trim(),
        department: regRoomName.trim(),
        mobileNumber: regMobileNumber.trim(),
        email: regEmail.trim(),
        createdAt: new Date().toISOString().split('T')[0]
      };

      const updatedAccounts = [...accounts, newAccount];
      setAccounts(updatedAccounts);
      localStorage.setItem('fireguard_registered_users', JSON.stringify(updatedAccounts));

      setIsLoading(false);
      setSuccessMsg(`Account created for ${newAccount.fullName} (${newAccount.role.toUpperCase()})! Connecting to surveillance matrix...`);
      soundAlarm.playBeep(980, 0.12);

      // Auto login after 1 second
      setTimeout(() => {
        onLogin({
          id: newAccount.id,
          username: newAccount.username,
          role: newAccount.role,
          fullName: newAccount.fullName,
          roomName: newAccount.roomName,
          department: newAccount.roomName,
          mobileNumber: newAccount.mobileNumber,
          email: newAccount.email,
          createdAt: newAccount.createdAt
        });
      }, 900);
    }, 400);
  };

  const handleQuickLoginAs = (account: StoredAccount) => {
    setLoginUsername(account.username);
    setLoginPassword(account.passwordHash);
    soundAlarm.playBeep(880, 0.08);
    onLogin({
      id: account.id,
      username: account.username,
      role: account.role === 'admin' ? 'admin' : 'user',
      fullName: account.fullName,
      roomName: account.roomName || account.department || 'Main Facility',
      department: account.roomName || account.department || 'Main Facility',
      mobileNumber: account.mobileNumber || '',
      email: account.email || `${account.username}@fireguard.ai`,
      createdAt: account.createdAt
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-neutral-900/40 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-lg z-10 my-4">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 text-white shadow-xl shadow-red-950/50 mb-3 border border-red-500/30">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-white">FIREGUARD AI</h1>
          <p className="text-neutral-400 text-sm mt-1">Autonomous Fire Detection & Surveillance System</p>
          <div className="inline-flex items-center gap-2 mt-2.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Diploma Final Year Project • Computer Engineering</span>
          </div>
        </div>

        {/* Authentication Card */}
        <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-2xl">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800 mb-6">
            <button
              id="tab-mode-login"
              type="button"
              onClick={() => {
                setActiveMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeMode === 'login'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Operator Sign In</span>
            </button>

            <button
              id="tab-mode-register"
              type="button"
              onClick={() => {
                setActiveMode('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeMode === 'register'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create New Account</span>
            </button>
          </div>

          {/* Error & Success Messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {activeMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5" htmlFor="input-username">
                  Operator Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="input-username"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5" htmlFor="input-password">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="checkbox-remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-neutral-950 border-neutral-700 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs text-neutral-300">Remember Credentials</span>
                </label>
                <span className="text-xs text-neutral-500 font-mono">SQLite Local Auth</span>
              </div>

              <button
                id="btn-login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 border border-red-500/30 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Authenticating Operator...
                  </span>
                ) : (
                  <>
                    <span>LOGIN TO SURVEILLANCE CONSOLE</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Registered Accounts List or Clean Empty State */}
              <div className="mt-5 pt-4 border-t border-neutral-800">
                {accounts.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                        Registered Operators ({accounts.length}):
                      </p>
                      <span className="text-[10px] text-neutral-500">Click to autofill</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {accounts.map((acc) => (
                        <div
                          key={acc.id}
                          onClick={() => handleQuickLoginAs(acc)}
                          className="relative p-2.5 text-left bg-neutral-950/80 hover:bg-neutral-800 rounded-xl border border-neutral-800/80 hover:border-neutral-700 transition-all text-xs group cursor-pointer"
                        >
                          <div className="flex items-center justify-between pr-5">
                            <span className="font-semibold text-neutral-200 group-hover:text-white font-mono truncate">
                              {acc.username}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                              acc.role === 'admin'
                                ? 'bg-red-950 text-red-400 border border-red-800/60'
                                : 'bg-sky-950 text-sky-400 border border-sky-800/60'
                            }`}>
                              {acc.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 truncate mt-1">{acc.fullName}</p>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px] text-neutral-500">
                            <span className="text-neutral-400 truncate">📍 {acc.roomName || acc.department || 'Sector A'}</span>
                            <span className="text-sky-400 font-mono truncate shrink-0">📱 {acc.mobileNumber || 'No phone'}</span>
                          </div>

                          {/* Delete Account button */}
                          <button
                            type="button"
                            title="Delete this registered account"
                            onClick={(e) => handleDeleteAccount(acc.id, e)}
                            className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-900 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs text-neutral-400 mb-2">
                      No accounts registered yet. Default accounts have been removed.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode('register');
                        setErrorMsg('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-medium transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-red-400" />
                      <span>Register New Operator Account</span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* CREATE NEW ACCOUNT FORM */}
          {activeMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1" htmlFor="input-reg-name">
                  Full Name
                </label>
                <input
                  id="input-reg-name"
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="e.g. Officer Sarah Jenkins"
                  className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              {/* Email ID & Mobile Number (for Telegram) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email ID */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1" htmlFor="input-reg-email">
                    Email ID
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      id="input-reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. sarah@fireguard.ai"
                      className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Mobile Number for Telegram */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1 flex items-center justify-between" htmlFor="input-reg-mobile">
                    <span>Mobile Number</span>
                    <span className="text-[10px] text-sky-400 font-normal normal-case flex items-center gap-0.5">
                      <Send className="w-2.5 h-2.5" /> For Telegram
                    </span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <input
                      id="input-reg-mobile"
                      type="tel"
                      value={regMobileNumber}
                      onChange={(e) => setRegMobileNumber(e.target.value)}
                      placeholder="+1 (555) 012-3456"
                      className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Room Name (Free Text) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1" htmlFor="input-reg-room">
                  Room Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <DoorOpen className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="input-reg-room"
                    type="text"
                    value={regRoomName}
                    onChange={(e) => setRegRoomName(e.target.value)}
                    placeholder="e.g. Room 302, Chemical Storage, Server Room B3"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono"
                    required
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">Enter your assigned surveillance sector or room location as free text.</p>
              </div>

              {/* Username & 2 Roles (Admin / User) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1" htmlFor="input-reg-username">
                    Operator Username
                  </label>
                  <input
                    id="input-reg-username"
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. sjenkins"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono"
                    required
                  />
                </div>

                {/* Role selection: Only 2 roles - Admin and User */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1">
                    Role (Admin or User)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      id="btn-role-admin"
                      type="button"
                      onClick={() => setRegRole('admin')}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        regRole === 'admin'
                          ? 'bg-red-950/90 border-red-500 text-white ring-1 ring-red-500/80'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Admin</span>
                        <Shield className="w-3 h-3 text-red-400" />
                      </div>
                      <p className="text-[9px] text-neutral-400 mt-0.5 leading-tight">Full Authority</p>
                    </button>

                    <button
                      id="btn-role-user"
                      type="button"
                      onClick={() => setRegRole('user')}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        regRole === 'user'
                          ? 'bg-sky-950/90 border-sky-500 text-white ring-1 ring-sky-500/80'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">User</span>
                        <User className="w-3 h-3 text-sky-400" />
                      </div>
                      <p className="text-[9px] text-neutral-400 mt-0.5 leading-tight">Surveillance</p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1" htmlFor="input-reg-password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="input-reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 4 characters"
                      className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono pr-8"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-500 hover:text-neutral-300"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1" htmlFor="input-reg-confirm-password">
                    Confirm Password
                  </label>
                  <input
                    id="input-reg-confirm-password"
                    type={showRegPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono"
                    required
                  />
                </div>
              </div>

              <button
                id="btn-register-submit"
                type="submit"
                disabled={isLoading}
                className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 border border-red-500/30 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Creating Profile...
                  </span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>REGISTER & ENTER SURVEILLANCE CONSOLE</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('login')}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Already have an operator account? <span className="text-red-400 font-semibold underline">Sign In</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Tech Stack Specs Footer */}
        <div className="mt-5 text-center text-xs text-neutral-500">
          <p className="flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1"><Terminal className="w-3 h-3" /> Python 3.11</span>
            <span>•</span>
            <span>PySide6 Desktop</span>
            <span>•</span>
            <span>SQLite Auth</span>
            <span>•</span>
            <span>YOLOv8</span>
            <span>•</span>
            <span>OpenCV Multi-Camera</span>
          </p>
        </div>
      </div>
    </div>
  );
};
