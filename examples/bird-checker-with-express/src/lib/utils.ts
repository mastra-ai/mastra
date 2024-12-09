export type ImageQuery = 'wildlife' | 'feathers' | 'flying' | 'birds';

export const getRandomImage = async ({ query }: { query: ImageQuery }) => {
  const page = Math.floor(Math.random() * 20);
  const order_by = Math.random() < 0.5 ? 'relevant' : 'latest';
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${query}&page=${page}&order_by=${order_by}`, {
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
      //@ts-ignore
      cache: 'no-store',
    });

    if (!res.ok) {
      console.log('res-----', res);
      return {
        ok: false,
        error: 'Failed to fetch image',
      };
    }

    const data = (await res.json()) as { results: any[] };
    const randomNo = Math.floor(Math.random() * data.results.length);

    const { urls, user } = data.results[randomNo];

    const resp = {
      imageUrl: urls?.raw,
      photographerName: user?.first_name,
      photographerProfile: user?.links?.html,
    };

    return {
      ok: true,
      data: resp,
    };
  } catch (err) {
    console.log('Error in get_random_image api executor===', err);
    return {
      ok: false,
      error: 'Error fetching image',
    };
  }
};
