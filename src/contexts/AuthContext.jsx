import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { isAdminEmail } from "../config/admin";
import { auth, db } from "../config/firebase";
import { AuthContext } from "./authContextInstance";

const ALLOWED_DOMAIN = "@sef.sc.gov.br";

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const profileRef = doc(db, "users", firebaseUser.uid);
      const profileSnap = await getDoc(profileRef);
      const nextRole =
        profileSnap.exists() && profileSnap.data().role === "admin"
          ? "admin"
          : isAdminEmail(firebaseUser.email)
            ? "admin"
            : "user";

      const profileData = {
        name: profileSnap.exists() ? profileSnap.data().name || firebaseUser.displayName || "" : firebaseUser.displayName || "",
        email: firebaseUser.email || "",
        role: nextRole,
        updatedAt: serverTimestamp(),
      };

      await setDoc(profileRef, {
        ...profileData,
        createdAt: profileSnap.exists() ? profileSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
      }, { merge: true });

      setProfile({
        ...profileData,
        ...(profileSnap.exists() ? profileSnap.data() : {}),
        role: nextRole,
      });
      setLoading(false);
    });
    return unsub;
  }, []);

  async function register(name, email, password) {
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      throw new Error(`Apenas e-mails ${ALLOWED_DOMAIN} têm acesso ao sistema.`);
    }
    const existingUsersSnapshot = await getDocs(query(collection(db, "users"), limit(1)));
    const isFirstUser = existingUsersSnapshot.empty;
    const role = isFirstUser || isAdminEmail(email) ? "admin" : "user";
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return cred.user;
  }

  async function login(email, password) {
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      throw new Error(`Apenas e-mails ${ALLOWED_DOMAIN} têm acesso ao sistema.`);
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: profile?.role === "admin",
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
