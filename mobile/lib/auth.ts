import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_KEY = 'user_session';

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    iosClientId: '517026320231-5qj1rochv8lr6qj3k98q6qh2p6nahhb7.apps.googleusercontent.com',
  });
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const user: User = {
      id: userInfo.data?.user.id ?? '',
      email: userInfo.data?.user.email ?? '',
      name: userInfo.data?.user.name ?? '',
      picture: userInfo.data?.user.photo ?? '',
    };
    await saveUser(user);
    return user;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw error;
  }
}

export async function signOutGoogle() {
  await GoogleSignin.signOut();
  await clearUser();
}

export async function saveUser(user: User) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<User | null> {
  const val = await AsyncStorage.getItem(USER_KEY);
  return val ? JSON.parse(val) : null;
}

export async function clearUser() {
  await AsyncStorage.removeItem(USER_KEY);
}
