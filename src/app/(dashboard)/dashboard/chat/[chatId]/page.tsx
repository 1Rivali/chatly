import ChatInput from '@/components/ChatInput';
import Messages from '@/components/Messages';
import { fetchRedis } from '@/helpers/redis';
import { authOptions } from '@/lib/auth';
import { messagesArrayValidator } from '@/lib/validations/message';
import { getServerSession } from 'next-auth';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { FC } from 'react';

interface PageProps {
  params: {
    chatId: string;
  };
}
async function getChatMessages(chatId: string) {
  try {
    const results: string[] = await fetchRedis(
      'zrange',
      `chat:${chatId}:messages`,
      0,
      -1
    );
    const dbMessages: Message[] = results.map(
      (message) => JSON.parse(message) as Message
    );

    const reversedDbMessages = dbMessages.reverse();

    const messages = messagesArrayValidator.parse(reversedDbMessages);

    return messages;
  } catch (error) {
    notFound();
  }
}

const Page: FC<PageProps> = async ({ params }) => {
  const { chatId } = params;
  const session = await getServerSession(authOptions);

  if (!session) notFound();

  const { user } = session;

  const [firstUserId, secondUserId] = chatId.split('--');

  if (user.id !== firstUserId && user.id !== secondUserId) {
    notFound();
  }

  const chatPartnerId = user.id === firstUserId ? secondUserId : firstUserId;
  const chatPartnerRaw: string = await fetchRedis(
    'get',
    `user:${chatPartnerId}`
  );
  const chatPartner: User = JSON.parse(chatPartnerRaw);

  const initialMessages = await getChatMessages(chatId);
  return (
    <div className="flex-1 justify-between flex flex-col h-full max-h-[calc(100vh-6rem)]">
      <div className="flex sm:items-center justify-between py-3 border-b-2 border-gray-200">
        <div className="relative flex items-center space-x-4">
          <div className="relative">
            <div className="relative w-8 sm:w-12 h-8 sm:h-12">
              <Image
                fill
                referrerPolicy="no-referrer"
                src={chatPartner.image}
                alt={`${chatPartner.name} profile picture`}
                className="rounded-full"
              />
            </div>
          </div>

          <div className="flex flex-col leading-tight">
            <div className="text-xl flex items-center">
              <span className="text-gray-700 mr-3 font-semibold">
                {chatPartner.name}
              </span>
            </div>

            <span className="text-sm text-gray-600">{chatPartner.email}</span>
          </div>
        </div>
      </div>
      <Messages
        chatId={chatId}
        chatPartner={chatPartner}
        sessionImg={session.user.image}
        initialMessages={initialMessages}
        sessionId={session.user.id}
      />
      <ChatInput chatId={chatId} chatPartnet={chatPartner} />
    </div>
  );
};

export default Page;
