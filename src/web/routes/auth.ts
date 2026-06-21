import { Router } from 'express';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

const DISCORD_AUTH_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7日

authRouter.get('/discord', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID!,
    redirect_uri: `${process.env.WEB_BASE_URL}/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`${DISCORD_AUTH_URL}?${params}`);
});

authRouter.get('/discord/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) { res.redirect('/'); return; }

  try {
    const tokenRes = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.WEB_BASE_URL}/auth/discord/callback`,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token: string };

    const userRes = await fetch(DISCORD_USER_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json() as {
      id: string;
      global_name?: string;
      username: string;
      avatar?: string;
    };

    const displayName = user.global_name ?? user.username;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) % 6n)}.png`;

    const token = jwt.sign(
      { userId: user.id, displayName, avatarUrl },
      process.env.SESSION_SECRET!,
      { expiresIn: '7d' },
    );

    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: COOKIE_MAX_AGE });
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[auth] Discord OAuth2 error:', err);
    res.redirect('/?error=1');
  }
});

authRouter.get('/logout', (_req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});
