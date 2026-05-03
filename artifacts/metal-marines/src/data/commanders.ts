import vossImg from "@/assets/commanders/voss.png";
import rheImg from "@/assets/commanders/rhe.png";
import calderImg from "@/assets/commanders/calder.png";
import iyobiImg from "@/assets/commanders/iyobi.png";
import stryxImg from "@/assets/commanders/stryx.png";
import nullImg from "@/assets/commanders/null.png";
import type { CommanderProfile } from "@/game/types";

export const COMMANDERS: Record<string, CommanderProfile> = {
  voss: {
    id: "voss",
    name: "Cadet Voss",
    bio: "Fresh out of the Academy. Builds by the book and rarely improvises. A clean first contact.",
    imageUrl: vossImg,
  },
  rhe: {
    id: "rhe",
    name: "Captain Rhe",
    bio: "Defensive doctrine specialist. Walls of AA and missile silos. Punishes overcommitted attacks.",
    imageUrl: rheImg,
  },
  calder: {
    id: "calder",
    name: "Major Calder",
    bio: "Ex-mercenary turned Coalition officer. Loves a fast Mech rush, hates a fair fight.",
    imageUrl: calderImg,
  },
  iyobi: {
    id: "iyobi",
    name: "Colonel Iyobi",
    bio: "Tactician. Coordinated dummy strikes followed by salvos of live ICBMs. Wear her down.",
    imageUrl: iyobiImg,
  },
  stryx: {
    id: "stryx",
    name: "General Stryx",
    bio: "The hammer of the Iron Bloc. Massive economy, relentless missile pressure. Survive the storm.",
    imageUrl: stryxImg,
  },
  null_: {
    id: "null_",
    name: "Overlord NULL",
    bio: "An autonomous war intelligence. No fear, no fatigue, no mercy. End it here.",
    imageUrl: nullImg,
  },
};
