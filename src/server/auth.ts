import { eq } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

import { env } from "~/env";
import { db } from "~/server/db";
import { memberships, users, workspaces } from "~/server/db/schema";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      try {
        // Check if user exists
        const existingUsers = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        let userId: string;

        if (existingUsers.length === 0) {
          // Create new user
          const newUsers = await db
            .insert(users)
            .values({
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
              googleId: account?.providerAccountId ?? null,
            })
            .returning();

          userId = newUsers[0]!.id;

          // Create default workspace for new user
          const slug = user.email.split("@")[0] + "-" + Date.now();
          const workspaceName = user.name
            ? `${user.name}'s Workspace`
            : "My Workspace";

          const newWorkspaces = await db
            .insert(workspaces)
            .values({
              name: workspaceName,
              slug,
              ownerId: userId,
              credits: 1, // Default free credit
            })
            .returning();

          // Create membership
          await db.insert(memberships).values({
            userId,
            workspaceId: newWorkspaces[0]!.id,
            role: "owner",
          });
        } else {
          // Update existing user's googleId if not set
          userId = existingUsers[0]!.id;
          if (!existingUsers[0]!.googleId && account?.providerAccountId) {
            await db
              .update(users)
              .set({ googleId: account.providerAccountId })
              .where(eq(users.id, userId));
          }
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({ token, user, account }) {
      // On sign in, fetch the user ID and store it in the token
      if (user?.email) {
        const dbUsers = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (dbUsers.length > 0) {
          token.id = dbUsers[0]!.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Add user id from token to session
      if (token.id && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
