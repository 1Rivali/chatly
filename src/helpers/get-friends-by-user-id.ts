import { fetchRedis } from './redis';

export const getFriendsByUserId = async (userId: string) => {
  const friendsIds: string[] = await fetchRedis(
    'smembers',
    `user:${userId}:friends`
  );

  const friends = await Promise.all(
    friendsIds.map(async (friendId) => {
      const friend: string = await fetchRedis('get', `user:${friendId}`);
      const parsedFriend: User = JSON.parse(friend);
      return parsedFriend;
    })
  );
  return friends;
};
