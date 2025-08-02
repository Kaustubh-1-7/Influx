// src/app/api/auth/[...nextauth]/route.js

import NextAuth from "next-auth";
import GitHubProvider from "next-auth/providers/github";

export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    // We add the github username to the token so we can access it everywhere.
    async jwt({ token, profile }) {
      if (profile) { // `profile` is only available on initial sign-in
        token.githubUsername = profile.login;
      }
      return token;
    },
    // We pass the github username from the token to the client-side session object.
    async session({ session, token }) {
      session.user.githubUsername = token.githubUsername;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };