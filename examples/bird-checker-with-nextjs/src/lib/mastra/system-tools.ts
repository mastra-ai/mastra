export type Image = {
  alt_description: string;
  urls: {
    regular: string;
    raw: string;
  };
  user: {
    first_name: string;
    links: {
      html: string;
    };
  };
};

export type ImageResponse<T, K> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: K;
    };

export type ImageQuery = "wildlife" | "feathers" | "flying" | "birds";

export const getRandomImage = async ({
  query,
}: {
  query: ImageQuery;
}): Promise<ImageResponse<Image, string>> => {
  const page = Math.floor(Math.random() * 20);
  const order_by = Math.random() < 0.5 ? "relevant" : "latest";
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&page=${page}&order_by=${order_by}`,
      {
        method: "GET",
        headers: {
          Authorization: `Client-ID ${process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY}`,
          "Accept-Version": "v1",
        },
        cache: "no-store",
      },
    );

    console.log("res in get_random_image api executor===", res);

    if (!res.ok) {
      return {
        ok: false,
        error: "Failed to fetch image",
      };
    }

    const data = (await res.json()) as {
      results: Array<Image>;
    };
    const randomNo = Math.floor(Math.random() * data.results.length);
    console.log("data ====", JSON.stringify(data.results[randomNo], null, 2));

    return {
      ok: true,
      data: data.results[randomNo] as Image,
    };
  } catch (err) {
    console.log("Error in get_random_image api executor===", err);
    return {
      ok: false,
      error: "Error fetching image",
    };
  }
};
