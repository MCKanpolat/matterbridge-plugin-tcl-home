import { createHash, createHmac } from "node:crypto";
import { BREEVA_FUNCTIONS, firstValue } from "./breeva-map.js";

export type Json = Record<string, any>;
export interface TclHomeConfig {
  username: string;
  password: string;
  appLoginUrl: string;
  cloudUrl: string;
  debug?: boolean;
}
export interface TclDevice {
  deviceId: string;
  productKey?: string;
  category?: string;
  deviceType?: string;
  deviceName?: string;
  nickName?: string;
  isOnline: boolean;
  raw: Json;
}

const APP_ID = "wx6e1af3fa84fbe523";
const md5 = (value: string) => createHash("md5").update(value).digest("hex");
const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;
const jwtPayload = (token: string): Json => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as Json;
  } catch {
    return {};
  }
};

export class TclHomeClient {
  private auth?: Json;
  private refresh?: Json;
  private urls?: Json;
  private credentials?: Json;
  constructor(
    private readonly config: TclHomeConfig,
    private readonly log: (message: string, error?: boolean) => void,
  ) {}

  private async request(url: string, init: RequestInit = {}): Promise<Json> {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    const body = (await response.json()) as Json;
    if (!response.ok) throw new Error(`HTTP ${response.status} from TCL Home`);
    return body;
  }
  private async login(): Promise<void> {
    try {
      const body = await this.request(this.config.appLoginUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=UTF-8",
          th_platform: "android",
          th_version: "4.8.1",
          th_appbulid: "830",
          "user-agent": "Android",
        },
        body: JSON.stringify({
          equipment: 2,
          password: md5(this.config.password),
          osType: 1,
          username: this.config.username,
          clientVersion: "4.8.1",
          osVersion: "6.0",
          deviceModel: "AndroidAndroid SDK built for x86",
          captchaRule: 2,
          channel: "app",
        }),
      });
      if (body.status !== 1 || !body.token) throw new Error("TCL Home login rejected");
      this.auth = body;
      this.log("TCL Home login succeeded");
    } catch (error) {
      this.log(
        `TCL Home login failed: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
      throw error;
    }
  }
  private async ensureSession(): Promise<void> {
    if (!this.auth || (jwtPayload(this.auth.token).exp ?? 0) < Date.now() / 1000 + 60)
      await this.login();
    if (!this.urls)
      this.urls = (
        await this.request(this.config.cloudUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": "Android" },
          body: JSON.stringify({ ssoId: this.config.username, ssoToken: this.auth!.token }),
        })
      ).data;
    if (
      !this.refresh ||
      (jwtPayload(this.refresh.saas_token).expiredDate ?? 0) < Date.now() / 1000 + 60
    ) {
      const base = text(this.urls!.cloud_url) ?? "";
      const result = await this.request(`${base}/v3/auth/refresh_tokens`, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "Android" },
        body: JSON.stringify({
          userId: this.config.username,
          ssoToken: this.auth!.token,
          appId: APP_ID,
        }),
      });
      if (result.code !== undefined && result.code !== 0)
        throw new Error(`TCL token refresh failed: ${result.message ?? result.code}`);
      this.refresh = result.data;
    }
    if (!this.credentials || Number(this.credentials.Expiration ?? 0) < Date.now() + 60_000)
      await this.loadAwsCredentials();
  }
  private async loadAwsCredentials(): Promise<void> {
    const token = text(this.refresh!.cognito_token);
    const region = text(this.urls!.cloud_region) ?? "us-east-1";
    if (!token) throw new Error("TCL Home did not return a Cognito token");
    const identityId = jwtPayload(token).sub;
    const response = await this.request(`https://cognito-identity.${region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": "AWSCognitoIdentityService.GetCredentialsForIdentity",
        "user-agent": "aws-sdk-android/2.22.6",
      },
      body: JSON.stringify({
        IdentityId: identityId,
        Logins: { "cognito-identity.amazonaws.com": token },
      }),
    });
    this.credentials = response.Credentials;
  }
  private signedHeaders(): Record<string, string> {
    const timestamp = String(Date.now());
    const nonce = Math.random().toString(36).slice(2, 18);
    const token = text(this.refresh!.saas_token) ?? "";
    return {
      platform: "android",
      appversion: "5.4.1",
      thomeversion: "4.8.1",
      accesstoken: token,
      "accept-language": "en",
      timestamp,
      nonce,
      sign: md5(timestamp + nonce + token),
      "content-type": "application/json; charset=UTF-8",
      "user-agent": "Android",
    };
  }
  async discover(): Promise<TclDevice[]> {
    await this.ensureSession();
    const result = await this.request(`${this.urls!.device_url}/v3/user/get_things`, {
      method: "POST",
      headers: this.signedHeaders(),
      body: "{}",
    });
    const list = Array.isArray(result.data) ? result.data : [];
    return list
      .map((raw: Json) => ({
        deviceId: text(raw.device_id ?? raw.deviceId) ?? "",
        productKey: text(raw.product_key ?? raw.productKey),
        category: text(raw.category),
        deviceType: text(raw.device_type ?? raw.deviceType),
        deviceName: text(raw.device_name ?? raw.deviceName),
        nickName: text(raw.nick_name ?? raw.nickName),
        isOnline: Boolean(raw.is_online ?? raw.isOnline),
        raw,
      }))
      .filter((device) => device.deviceId);
  }
  async getDeviceConfig(device: TclDevice): Promise<Json> {
    await this.ensureSession();
    const result = await this.request(`${this.urls!.cloud_url}/v3/config/get`, {
      method: "POST",
      headers: this.signedHeaders(),
      body: JSON.stringify({
        productKey: device.productKey,
        countryCode: this.auth?.user?.country_abbr,
      }),
    });
    return (result.data ?? result) as Json;
  }
  async readState(device: TclDevice): Promise<Json> {
    await this.ensureSession();
    const endpoint = text(this.refresh!.mqtt_endpoint);
    if (!endpoint || !this.credentials) return {};
    return this.awsShadow(endpoint, device.deviceId, "GET");
  }
  async sendCommand(device: TclDevice, desired: Json): Promise<void> {
    await this.ensureSession();
    const endpoint = text(this.refresh!.mqtt_endpoint);
    if (!endpoint || !this.credentials) {
      this.log(
        `Command queued for ${device.deviceId}; AWS IoT credentials are not initialized`,
        true,
      );
      return;
    }
    await this.awsShadow(endpoint, device.deviceId, "POST", {
      state: { desired },
      clientToken: `matterbridge_${Date.now()}`,
    });
  }
  private async awsShadow(
    endpoint: string,
    deviceId: string,
    method: "GET" | "POST",
    body?: Json,
  ): Promise<Json> {
    // The AWS IoT shadow path is kept isolated so Cognito/SigV4 can be adjusted without touching Matter mapping.
    const host = endpoint.startsWith("http") ? endpoint : `https://${endpoint}`;
    const url = `${host.replace(/\/$/, "")}/things/${encodeURIComponent(deviceId)}/shadow`;
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : "";
    const headers = this.signAwsRequest(method, parsed, payload);
    const response = await fetch(url, {
      method,
      headers,
      ...(payload ? { body: payload } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`AWS IoT shadow HTTP ${response.status}`);
    return (await response.json()) as Json;
  }
  private signAwsRequest(method: string, url: URL, payload: string): Record<string, string> {
    const accessKey = text(this.credentials?.AccessKeyId);
    const secret = text(this.credentials?.SecretKey);
    const session = text(this.credentials?.SessionToken);
    if (!accessKey || !secret) throw new Error("AWS IoT credentials are unavailable");
    const region = text(this.urls!.cloud_region) ?? "us-east-1";
    const service = "iotdata";
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const contentHash = createHash("sha256").update(payload).digest("hex");
    const headers: Record<string, string> = {
      host: url.host,
      "content-type": "application/json",
      "x-amz-date": amzDate,
      "x-amz-content-sha256": contentHash,
    };
    if (session) headers["x-amz-security-token"] = session;
    const signedNames = Object.keys(headers).sort();
    const canonicalHeaders = signedNames
      .map((name) => `${name}:${headers[name]!.trim()}\n`)
      .join("");
    const canonical = `${method}\n${url.pathname}\n${url.search.slice(1)}\n${canonicalHeaders}\n${signedNames.join(";")}\n${contentHash}`;
    const scope = `${date}/${region}/${service}/aws4_request`;
    const signingKey = createHmac(
      "sha256",
      createHmac(
        "sha256",
        createHmac("sha256", createHmac("sha256", `AWS4${secret}`).update(date).digest())
          .update(region)
          .digest(),
      )
        .update(service)
        .digest(),
    )
      .update("aws4_request")
      .digest();
    const signature = createHmac("sha256", signingKey)
      .update(
        `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash("sha256").update(canonical).digest("hex")}`,
      )
      .digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedNames.join(";")}, Signature=${signature}`;
    return headers;
  }
  extractState(raw: Json): Json {
    const state = raw.state?.reported ?? raw.state?.desired ?? raw.reported ?? raw;
    return {
      power: firstValue(state, BREEVA_FUNCTIONS.power),
      fanSpeed: firstValue(state, BREEVA_FUNCTIONS.fanSpeed),
      mode: firstValue(state, BREEVA_FUNCTIONS.mode),
      airQuality: firstValue(state, BREEVA_FUNCTIONS.airQuality),
      filterLife: firstValue(state, BREEVA_FUNCTIONS.filterLife),
      filterWarning: firstValue(state, BREEVA_FUNCTIONS.filterWarning),
    };
  }
}
