import React, { useState } from 'react';
import { 
  auth, 
  db 
} from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  collection,
  getDocs
} from 'firebase/firestore';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  User, 
  Wrench, 
  CheckCircle, 
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  Sparkles,
  X,
  Check,
  HelpCircle,
  Key
} from 'lucide-react';
import { UserProfile, UserPermissions } from '../types';
import { METALOGIK_DEFAULT_USERS } from '../dbService';

interface LoginViewProps {
  onLoginSuccess: (userProfile: UserProfile) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  // Mode: 'signin' | 'first_time'
  const [activeMode, setActiveMode] = useState<'signin' | 'first_time'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected staff member for dedicated modal
  const [selectedStaff, setSelectedStaff] = useState<typeof METALOGIK_DEFAULT_USERS[0] | null>(null);
  const [staffModalTab, setStaffModalTab] = useState<'first_time' | 'signin'>('first_time');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffConfirmPassword, setStaffConfirmPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffErrorMsg, setStaffErrorMsg] = useState('');
  const [staffSuccessMsg, setStaffSuccessMsg] = useState('');

  // Handle email change and auto-fill staff name if recognized
  const handleEmailChange = (val: string) => {
    setEmail(val);
    const matched = METALOGIK_DEFAULT_USERS.find(u => u.email.toLowerCase() === val.trim().toLowerCase());
    if (matched && (!displayName || METALOGIK_DEFAULT_USERS.some(u => u.name === displayName))) {
      setDisplayName(matched.name);
    }
  };

  // 1. Regular Sign-In Handler (for users who already have a saved password)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const emailTrimmed = email.trim().toLowerCase();
      const matchedMetalogik = METALOGIK_DEFAULT_USERS.find(u => u.email.toLowerCase() === emailTrimmed);
      
      const credential = await signInWithEmailAndPassword(auth, emailTrimmed, password);
      const uid = credential.user.uid;

      // Fetch or update user profile document in Firestore
      const profileDoc = await getDoc(doc(db, 'users', uid));
      if (profileDoc.exists()) {
        const loadedProfile = profileDoc.data() as UserProfile;
        if (matchedMetalogik) {
          const updatedProfile: UserProfile = {
            ...loadedProfile,
            displayName: matchedMetalogik.name,
            permissions: matchedMetalogik.perms
          };
          await setDoc(doc(db, 'users', uid), updatedProfile, { merge: true });
          onLoginSuccess(updatedProfile);
        } else {
          onLoginSuccess(loadedProfile);
        }
      } else {
        const perms: UserPermissions = matchedMetalogik?.perms || {
          canReceive: false,
          canInspect: false,
          canQuote: false,
          canCreateJobCard: false,
          canStores: false,
          canWorksheet: false,
          canReporting: false,
          canClose: false,
          isAdmin: false
        };
        const profile: UserProfile = {
          uid,
          email: emailTrimmed,
          displayName: matchedMetalogik?.name || displayName.trim() || emailTrimmed.split('@')[0],
          password,
          permissions: perms,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', uid), profile, { merge: true });
        onLoginSuccess(profile);
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      // Fallback check against saved user profile password
      try {
        const emailTrimmed = email.trim().toLowerCase();
        const userSnapshot = await getDocs(collection(db, 'users'));
        const matchedUser = userSnapshot.docs
          .map(d => d.data() as UserProfile)
          .find(u => (u.email || '').toLowerCase().trim() === emailTrimmed);

        if (matchedUser && matchedUser.password && matchedUser.password === password) {
          onLoginSuccess(matchedUser);
          setIsLoading(false);
          return;
        }
      } catch (dbErr) {
        console.error("Fallback auth check error:", dbErr);
      }

      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setErrorMsg('No user account or password found for this email. If this is your first time signing in, please click "First-Time Sign In / Create Password" above.');
      } else if (err.code === 'auth/wrong-password') {
        setErrorMsg('Incorrect password. Please check your password or reset it.');
      } else {
        setErrorMsg(err.message || 'Authentication failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. First-Time Sign-In Handler (creates account, sets & saves the password)
  const handleFirstTimeCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both password fields match.');
      return;
    }

    setIsLoading(true);

    try {
      const emailTrimmed = email.trim().toLowerCase();
      const matchedMetalogik = METALOGIK_DEFAULT_USERS.find(u => u.email.toLowerCase() === emailTrimmed);
      
      // 1. Create account with the user's chosen password
      const credential = await createUserWithEmailAndPassword(auth, emailTrimmed, password);
      const uid = credential.user.uid;

      // 2. Configure official permissions
      const perms: UserPermissions = matchedMetalogik?.perms || {
        canReceive: false,
        canInspect: false,
        canQuote: false,
        canCreateJobCard: false,
        canStores: false,
        canWorksheet: false,
        canReporting: false,
        canClose: false,
        isAdmin: false
      };

      const profile: UserProfile = {
        uid,
        email: emailTrimmed,
        displayName: displayName.trim() || matchedMetalogik?.name || emailTrimmed.split('@')[0],
        password,
        permissions: perms,
        createdAt: new Date().toISOString()
      };

      // 3. Save profile to Firestore
      await setDoc(doc(db, 'users', uid), profile, { merge: true });
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error("First-time password creation error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('A password has already been created for this account. Please switch to the "Sign In" tab and enter your saved password.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password is too weak. Please use at least 6 characters.');
      } else {
        setErrorMsg(err.message || 'Could not save password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Staff Modal Action: First-time setup or sign in for selected staff member
  const handleStaffModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setStaffErrorMsg('');
    setStaffSuccessMsg('');
    setIsLoading(true);

    const emailTrimmed = selectedStaff.email.toLowerCase();

    if (staffModalTab === 'first_time') {
      // First-time password creation
      if (staffPassword.length < 6) {
        setStaffErrorMsg('Password must be at least 6 characters.');
        setIsLoading(false);
        return;
      }
      if (staffPassword !== staffConfirmPassword) {
        setStaffErrorMsg('Passwords do not match. Please verify.');
        setIsLoading(false);
        return;
      }

      try {
        const credential = await createUserWithEmailAndPassword(auth, emailTrimmed, staffPassword);
        const uid = credential.user.uid;

        const profile: UserProfile = {
          uid,
          email: emailTrimmed,
          displayName: selectedStaff.name,
          password: staffPassword,
          permissions: selectedStaff.perms,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', uid), profile, { merge: true });
        setSelectedStaff(null);
        onLoginSuccess(profile);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          setStaffErrorMsg('A password has already been set up for this account. Switch to "Sign In with Password" tab below.');
          setStaffModalTab('signin');
        } else {
          setStaffErrorMsg(err.message || 'Failed to set password.');
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Sign in with existing saved password
      try {
        const credential = await signInWithEmailAndPassword(auth, emailTrimmed, staffPassword);
        const uid = credential.user.uid;

        const profile: UserProfile = {
          uid,
          email: emailTrimmed,
          displayName: selectedStaff.name,
          password: staffPassword,
          permissions: selectedStaff.perms,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', uid), profile, { merge: true });
        setSelectedStaff(null);
        onLoginSuccess(profile);
      } catch (err: any) {
        // Fallback check against saved user profile password
        try {
          const userSnapshot = await getDocs(collection(db, 'users'));
          const matchedUser = userSnapshot.docs
            .map(d => d.data() as UserProfile)
            .find(u => (u.email || '').toLowerCase().trim() === emailTrimmed);

          if (matchedUser && matchedUser.password && matchedUser.password === staffPassword) {
            setSelectedStaff(null);
            onLoginSuccess(matchedUser);
            setIsLoading(false);
            return;
          }
        } catch (dbErr) {
          console.error("Fallback staff auth check error:", dbErr);
        }

        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setStaffErrorMsg('Incorrect password. If you have not created your password yet, switch to the "First-Time Sign In" tab.');
        } else if (err.code === 'auth/user-not-found') {
          setStaffErrorMsg('No password created yet. Please use the "First-Time Sign In (Create Password)" tab.');
          setStaffModalTab('first_time');
        } else {
          setStaffErrorMsg(err.message || 'Sign in failed.');
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Password reset email handler
  const handleForgotPassword = async () => {
    const targetEmail = selectedStaff?.email || email;
    if (!targetEmail) {
      setErrorMsg('Please enter your email address above to receive a password reset link.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await sendPasswordResetEmail(auth, targetEmail.trim().toLowerCase());
      const msg = `Password reset instructions have been sent to ${targetEmail}. Please check your inbox.`;
      setSuccessMsg(msg);
      if (selectedStaff) setStaffSuccessMsg(msg);
    } catch (err: any) {
      const msg = err.message || 'Failed to send password reset email.';
      setErrorMsg(msg);
      if (selectedStaff) setStaffErrorMsg(msg);
    }
  };

  const openStaffModal = (staff: typeof METALOGIK_DEFAULT_USERS[0]) => {
    setSelectedStaff(staff);
    setStaffPassword('');
    setStaffConfirmPassword('');
    setStaffErrorMsg('');
    setStaffSuccessMsg('');
    setStaffModalTab('first_time');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans" id="login-view-root">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        {/* Logo */}
        <div className="bg-blue-600 text-white p-3 rounded-2xl w-14 h-14 flex items-center justify-center shadow-md mx-auto mb-3">
          <Wrench className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 font-display">
          Metalogik Workshop Portal
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Component Overhaul, Job Cards & Engineering Operations
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-6 px-5 sm:px-8 shadow-sm border border-slate-200 rounded-2xl">
          
          {/* Main Top Navigation Tabs: Sign In vs First-Time Setup */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-5 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveMode('signin');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'signin'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('first_time');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'first_time'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>First-Time Sign In (Create Password)</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-red-50 text-red-800 border border-red-200 p-3 rounded-xl text-xs font-semibold flex items-start gap-2 mb-4 text-left">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMsg}</span>
                {activeMode === 'signin' && errorMsg.includes('First-Time') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode('first_time');
                      setErrorMsg('');
                    }}
                    className="block mt-1.5 text-blue-700 underline font-bold cursor-pointer hover:text-blue-800"
                  >
                    Click here to create your password now →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4 text-left">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================
              TAB 1: REGULAR SIGN IN FORM
              ======================================================== */}
          {activeMode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3.5 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Metalogik Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. paulo@metalogik.co.za"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your saved password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-colors text-xs sm:text-sm disabled:opacity-55 cursor-pointer flex justify-center items-center gap-1.5"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                <span>First time signing in? </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('first_time');
                    setErrorMsg('');
                  }}
                  className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer ml-1"
                >
                  Create and save your password here
                </button>
              </div>
            </form>
          )}

          {/* ========================================================
              TAB 2: FIRST-TIME SIGN IN (CREATE & SAVE PASSWORD)
              ======================================================== */}
          {activeMode === 'first_time' && (
            <form onSubmit={handleFirstTimeCreatePassword} className="space-y-3.5 text-left">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>First-Time Password Creation</span>
                </div>
                <p className="text-[11px] text-blue-700/90 leading-relaxed">
                  Enter your Metalogik email and create a password. This password will be securely saved and used for all your future sign-ins.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paulo"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Metalogik Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. paulo@metalogik.co.za"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Create Password (Minimum 6 characters)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Choose a secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-enter password to confirm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9 pr-10 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && confirmPassword && (
                  <p className={`text-[10px] font-bold mt-1 ${password === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                    {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || (Boolean(password) && Boolean(confirmPassword) && password !== confirmPassword)}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-colors text-xs sm:text-sm disabled:opacity-55 cursor-pointer flex justify-center items-center gap-1.5"
              >
                {isLoading ? 'Saving Password & Signing In...' : 'Save Password & Enter Workshop'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                <span>Already set up your password? </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('signin');
                    setErrorMsg('');
                  }}
                  className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer ml-1"
                >
                  Switch to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Divider */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-white px-3 font-bold text-slate-400 tracking-wider">
                Metalogik Staff Team ({METALOGIK_DEFAULT_USERS.length} Members)
              </span>
            </div>
          </div>

          {/* 9 Metalogik User Profiles Grid */}
          <div className="mt-4 space-y-2 text-left">
            <p className="text-[11px] text-slate-500 font-medium text-center mb-2.5">
              Select your staff profile to create or enter your password:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {METALOGIK_DEFAULT_USERS.map(user => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => openStaffModal(user)}
                  disabled={isLoading}
                  className={`p-2.5 rounded-xl text-left border border-slate-200/80 shadow-2xs hover:shadow-sm hover:scale-[1.01] transition-all ${user.color} disabled:opacity-55 flex flex-col justify-between min-h-[78px] cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-extrabold text-xs tracking-tight truncate">{user.name}</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/20 shrink-0">
                      {user.roleBadge}
                    </span>
                  </div>
                  <div className="mt-1">
                    <p className="text-[10px] opacity-90 truncate font-mono">{user.email}</p>
                    <p className="text-[9px] opacity-75 font-medium mt-0.5 flex items-center gap-1">
                      <Key className="w-2.5 h-2.5" />
                      <span>{user.roleTitle}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================
          DEDICATED STAFF SIGN IN & FIRST-TIME SETUP MODAL
          ======================================================== */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-left animate-in fade-in-50 zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                  {selectedStaff.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-bold text-slate-800 font-display">{selectedStaff.name}</h3>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded border border-blue-200">
                      {selectedStaff.roleBadge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{selectedStaff.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-Tabs: First-Time Setup vs Sign In */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setStaffModalTab('first_time');
                  setStaffErrorMsg('');
                  setStaffSuccessMsg('');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  staffModalTab === 'first_time'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>First-Time Setup</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStaffModalTab('signin');
                  setStaffErrorMsg('');
                  setStaffSuccessMsg('');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  staffModalTab === 'signin'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            </div>

            {/* Error in modal */}
            {staffErrorMsg && (
              <div className="bg-red-50 text-red-800 border border-red-200 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="flex-1">{staffErrorMsg}</span>
              </div>
            )}

            {/* Success in modal */}
            {staffSuccessMsg && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="flex-1">{staffSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleStaffModalSubmit} className="space-y-3.5">
              {staffModalTab === 'first_time' ? (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    Welcome <strong className="text-slate-800">{selectedStaff.name}</strong>! If this is your first time signing in, please choose a password to save for your account.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Create Password (Minimum 6 characters)</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showStaffPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Create your password"
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        className="pl-9 pr-10 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showStaffPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Confirm password"
                        value={staffConfirmPassword}
                        onChange={(e) => setStaffConfirmPassword(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    {staffPassword && staffConfirmPassword && (
                      <p className={`text-[10px] font-bold mt-1 ${staffPassword === staffConfirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                        {staffPassword === staffConfirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    Welcome back <strong className="text-slate-800">{selectedStaff.name}</strong>! Enter your saved password to sign into the workshop portal.
                  </p>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Password</label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showStaffPassword ? 'text' : 'password'}
                        required
                        placeholder="Enter your saved password"
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        className="pl-9 pr-10 py-2 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || (staffModalTab === 'first_time' && Boolean(staffPassword) && Boolean(staffConfirmPassword) && staffPassword !== staffConfirmPassword)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-55"
                >
                  {isLoading
                    ? 'Processing...'
                    : staffModalTab === 'first_time'
                    ? 'Save Password & Sign In'
                    : 'Sign In'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

