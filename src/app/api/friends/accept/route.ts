import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { fetchRedis } from '@/helpers/redis';
import { db } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { toPusherKey } from '@/lib/utils';
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id: idToAdd } = z.object({ id: z.string() }).parse(body);
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }
    const isAlreadyFriends = await fetchRedis(
      'sismember',
      `user:${session.user.id}:friends`,
      idToAdd
    );
    if (isAlreadyFriends) {
      return new Response('Already Friends', { status: 400 });
    }
    const hasFriendRequest = await fetchRedis(
      'sismember',
      `user:${session.user.id}:incoming_friend_requests`,
      idToAdd
    );

    if (!hasFriendRequest) {
      return new Response('No Friend Request', { status: 400 });
    }

    const [userRaw, friendRaw]: string[] = await Promise.all([
      fetchRedis(`get`, `user:${session.user.id}`),
      fetchRedis(`get`, `user:${idToAdd}`),
    ]);
    const user: User = JSON.parse(userRaw);
    const friend: User = JSON.parse(friendRaw);

    await Promise.all([
      pusherServer.trigger(
        toPusherKey(`user:${idToAdd}:friends`),
        'new_friend',
        user
      ),

      pusherServer.trigger(
        toPusherKey(`user:${session.user.id}:friends`),
        'new_friend',
        friend
      ),

      db.sadd(`user:${session.user.id}:friends`, idToAdd),
      db.sadd(`user:${idToAdd}:friends`, session.user.id),
      db.srem(`user:${session.user.id}:incoming_friend_requests`, idToAdd),
    ]);

    return new Response('OK');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response('Invalid Request Payload', { status: 422 });
    }
    return new Response('Invalid request', { status: 400 });
  }
}
