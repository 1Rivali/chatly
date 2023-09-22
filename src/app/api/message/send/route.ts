import { fetchRedis } from '@/helpers/redis';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { toPusherKey } from '@/lib/utils';
import { messageValidator } from '@/lib/validations/message';
import { nanoid } from 'nanoid';
import { getServerSession } from 'next-auth';

export async function POST(req: Request) {
  try {
    const { text, chatId }: { text: string; chatId: string } = await req.json();
    const session = await getServerSession(authOptions);

    if (!session) return new Response('Unauthorized', { status: 401 });

    const [firstUserId, secondUserId] = chatId.split('--');
    if (session.user.id !== firstUserId && session.user.id !== secondUserId) {
      return new Response('Unauthorized', { status: 401 });
    }
    const friendId =
      session.user.id === firstUserId ? secondUserId : firstUserId;

    const friendList: string[] = await fetchRedis(
      'smembers',
      `user:${session.user.id}:friends`
    );

    const isFriend = friendList.includes(friendId);

    if (!isFriend) {
      return new Response('Unauthorized', { status: 401 });
    }

    const senderRaw: string = await fetchRedis(
      'get',
      `user:${session.user.id}`
    );

    const sender: User = JSON.parse(senderRaw);

    const timestamp = Date.now();

    const messageData: Message = {
      id: nanoid(),
      senderId: session.user.id,
      reciverId: friendId,
      text,
      timestamp,
    };
    const message = messageValidator.parse(messageData);

    await pusherServer.trigger(
      toPusherKey(`chat:${chatId}`),
      'incoming-message',
      message
    );

    await pusherServer.trigger(
      toPusherKey(`user:${friendId}:chats`),
      'new_message',
      {
        ...message,
        senderImg: sender.image,
        senderName: sender.name,
      }
    );

    await db.zadd(`chat:${chatId}:messages`, {
      score: timestamp,
      member: JSON.stringify(message),
    });

    return new Response('OK');
  } catch (error) {
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}
