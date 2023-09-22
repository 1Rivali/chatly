import { fetchRedis } from '@/helpers/redis';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { toPusherKey } from '@/lib/utils';
import { addFriendValidator } from '@/lib/validations/add-friend';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { email: emailToAdd } = addFriendValidator.parse(body.email);

    const idToAdd: string = await fetchRedis('get', `user:email:${emailToAdd}`);

    if (!idToAdd) {
      return new Response('This person does not exist.', { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (idToAdd === session.user.id) {
      return new Response("You can't add yourself as a Friend", {
        status: 400,
      });
    }

    const isAlreadyAdded = await fetchRedis(
      'sismember',
      `user:${idToAdd}:incoming_friend_requests`,
      session.user.id
    );
    if (isAlreadyAdded) {
      return new Response('You Already Added This User', { status: 400 });
    }
    const isAlreadyFreinds = await fetchRedis(
      'sismember',
      `user:${session.user.id}:friends`,
      idToAdd
    );
    if (isAlreadyFreinds) {
      return new Response('You Already Have This user as a Friend', {
        status: 400,
      });
    }

    // valid, Send Friend Request

    await pusherServer.trigger(
      toPusherKey(`user:${idToAdd}:incoming_friend_requests`),
      'incoming_friend_requests',
      {
        senderId: session.user.id,
        senderEmail: session.user.email,
      }
    );

    db.sadd(`user:${idToAdd}:incoming_friend_requests`, session.user.id);

    return new Response('OK');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response('Invalid Request payload', { status: 422 });
    }
    return new Response('Invalid Request', { status: 400 });
  }
}
