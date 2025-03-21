"use client";
import { useEffect, useState } from "react";

export const useFetchStars = () => {
  const [stars, setStars] = useState("0");

  useEffect(() => {
    const fetchStars = async () => {
      const res = await fetch("/githubStarCount.json");
      const data = await res.json();
      setStars(formatToK(data.githubStarCount));
    };
    fetchStars();
  }, []);

  return stars;
};

function formatToK(number: number) {
  if (number >= 1000) {
    return (number / 1000).toFixed(number % 1000 === 0 ? 0 : 1) + "k";
  }
  return number.toString();
}
