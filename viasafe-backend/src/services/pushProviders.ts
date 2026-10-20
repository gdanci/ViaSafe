import admin from "firebase-admin";

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export interface PushProvider {
  send(registrationToken: string, msg: PushMessage): Promise<void>;
}

export class NoopPushProvider implements PushProvider {
  async send(_registrationToken: string, _msg: PushMessage): Promise<void> {
    return;
  }
}

export class FirebasePushProvider implements PushProvider {
  private app: admin.app.App;

  constructor(serviceAccountJson: string) {
    const creds = JSON.parse(serviceAccountJson);
    this.app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(creds)
        });
  }

  async send(registrationToken: string, msg: PushMessage): Promise<void> {
    await this.app.messaging().send({
      token: registrationToken,
      notification: { title: msg.title, body: msg.body },
      data: msg.data
    });
  }
}