import type { MastraAuthProviderOptions } from '@internal/auth/provider';
import { MastraAuthProvider } from '@internal/auth/provider';

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type FirebaseUser = DecodedIdToken;

interface MastraAuthFirebaseOptions extends MastraAuthProviderOptions<FirebaseUser> {
  databaseId?: string;
  serviceAccount?: string;
}

export class MastraAuthFirebase extends MastraAuthProvider<FirebaseUser> {
  private serviceAccount: string | undefined;
  private databaseId: string | undefined;

  constructor(options?: MastraAuthFirebaseOptions) {
    super({ name: options?.name ?? 'firebase' });

    this.serviceAccount = options?.serviceAccount ?? process.env.FIREBASE_SERVICE_ACCOUNT;
    this.databaseId = options?.databaseId ?? process.env.FIRESTORE_DATABASE_ID ?? process.env.FIREBASE_DATABASE_ID;

    if (!getApps().length) {
      initializeApp({
        credential: this.serviceAccount ? cert(this.serviceAccount) : applicationDefault(),
      });
    }

    this.registerOptions(options);
  }

  async authenticateToken(token: string): Promise<FirebaseUser | null> {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  }

  async authorizeUser(user: FirebaseUser) {
    const db = this.databaseId ? getFirestore(this.databaseId) : getFirestore();
    const userAccess = await db.doc(`/user_access/${user.uid}`).get();
    const userAccessData = userAccess.data();

    if (!userAccessData) {
      return false;
    }

    return true;
  }
}
