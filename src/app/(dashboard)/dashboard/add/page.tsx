import AddFriendButton from '@/components/AddFriendButton';
import { FC } from 'react';

const Page: FC = ({}) => {
  return (
    <main className="pt-8">
      <h1 className="font-bold text-5xl mb-8">Add Friend</h1>
      <AddFriendButton />
    </main>
  );
};

export default Page;
