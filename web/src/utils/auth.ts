const options = {
  domain: Bun.env.KINDE_DOMAIN!,
  clientId: Bun.env.KINDE_CLIENT_ID!,
  clientSecret: Bun.env.KINDE_CLIENT_SECRET!,
  redirectUri: `${Bun.env.AUTH_URL!}/auth/callback`,
  logoutRedirectUri: `${Bun.env.AUTH_URL!}://${Bun.env.BASE_URL}/`,
};

export function generateRandomString(length: number): string {
  if (length <= 0 || !Number.isInteger(length)) {
    throw new Error("Invalid length. Length must be a positive integer.");
  }

  const randomBytes = crypto.getRandomValues(
    new Uint8Array(Math.ceil(length / 2))
  );

  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

export function getAuthorizationUrl(): [string, string] {
  const state = generateRandomString(16);

  const searchParams = new URLSearchParams({
    response_type: "code",
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    scope: "openid profile email",
    state: state,
  });

  const authorizationUrl = new URL(
    `${options.domain}/oauth2/auth?${searchParams.toString()}`
  );

  return [authorizationUrl.toString(), state];
}

export function getLogoutUrl(): string {
  const searchParams = new URLSearchParams({
    logout_uri: options.logoutRedirectUri,
  });
  const logoutUrl = new URL(
    `${options.domain}/logout?${searchParams.toString()}`
  );

  return logoutUrl.toString();
}

export function redirectToError({
  code,
  message,
  redirectTo,
  set,
}: {
  code?: string;
  message?: string;
  redirectTo?: string;
  set: { redirect?: string | undefined };
}) {
  const searchParams = new URLSearchParams({
    code: code || "UNKNOWN_ERROR",
    message: message || "Something went wrong.",
    redirectTo: redirectTo || "/",
  });

  const errorUrl = `/error?${searchParams.toString()}`;

  set.redirect = errorUrl;
}

export async function getUserAccessToken(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: options.redirectUri,
    scope: "openid profile email",
  });

  const response = await fetch(`${options.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(
        `${options.clientId}:${options.clientSecret}`
      )}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to get access token");
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    id_token: string;
    scope: string;
    token_type: string;
  };

  return data;
}

export async function getUserInfo(accessToken: string) {
  const response = await fetch(`${options.domain}/oauth2/v2/user_profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get user info");
  }

  const data = (await response.json()) as {
    sub: string;
    email: string;
    email_verified: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
  };

  return data;
}

export function isWithinExpiration(expires: Date) {
  return new Date().getTime() < expires.getTime();
}
