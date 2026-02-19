export interface SamplePostcard {
  id: string;
  title: string;
  location: string;
  language: string;
  frontImage: any;
  backImage: any;
}

export const samplePostcards: SamplePostcard[] = [
  {
    id: "sample-paris",
    title: "Paris, France",
    location: "Paris",
    language: "French",
    frontImage: require("@/assets/samples/paris_front.png"),
    backImage: require("@/assets/samples/paris_back.png"),
  },
  {
    id: "sample-tokyo",
    title: "Tokyo, Japan",
    location: "Tokyo",
    language: "Japanese",
    frontImage: require("@/assets/samples/tokyo_front.png"),
    backImage: require("@/assets/samples/tokyo_back.png"),
  },
  {
    id: "sample-santorini",
    title: "Santorini, Greece",
    location: "Santorini",
    language: "German",
    frontImage: require("@/assets/samples/santorini_front.png"),
    backImage: require("@/assets/samples/santorini_back.png"),
  },
];
