export interface SampleWordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SamplePostcard {
  id: string;
  title: string;
  location: string;
  language: string;
  frontImage: any;
  backImage: any;
  imageOnly?: boolean;
  originalText?: string;
  translatedText?: string;
  detectedLanguage?: string;
  description?: string;
  words?: string[];
  audioAsset?: any;
  durationMs?: number;
  wordTimings?: SampleWordTiming[];
}

const parisTimings: SampleWordTiming[] = [
  { word: "Dear", startMs: 0, endMs: 267 },
  { word: "Marie,", startMs: 325, endMs: 987 },
  { word: "Paris", startMs: 1196, endMs: 1649 },
  { word: "is", startMs: 1718, endMs: 1800 },
  { word: "magnificent!", startMs: 1881, endMs: 2868 },
  { word: "The", startMs: 3564, endMs: 3692 },
  { word: "croissants", startMs: 3750, endMs: 4331 },
  { word: "are", startMs: 4377, endMs: 4516 },
  { word: "delicious", startMs: 4551, endMs: 5201 },
  { word: "and", startMs: 5526, endMs: 5712 },
  { word: "the", startMs: 5747, endMs: 5852 },
  { word: "Eiffel", startMs: 5910, endMs: 6225 },
  { word: "Tower", startMs: 6260, endMs: 6516 },
  { word: "shines", startMs: 6551, endMs: 6935 },
  { word: "every", startMs: 6993, endMs: 7238 },
  { word: "night.", startMs: 7296, endMs: 7819 },
  { word: "I", startMs: 8445, endMs: 8503 },
  { word: "think", startMs: 8538, endMs: 8760 },
  { word: "of", startMs: 8795, endMs: 8876 },
  { word: "you.", startMs: 8935, endMs: 9377 },
  { word: "Kisses,", startMs: 10023, endMs: 10568 },
  { word: "Sophie.", startMs: 10626, endMs: 11993 },
];

const tokyoTimings: SampleWordTiming[] = [
  { word: "Dear", startMs: 0, endMs: 290 },
  { word: "Mom,", startMs: 348, endMs: 870 },
  { word: "Tokyo", startMs: 1070, endMs: 1580 },
  { word: "is", startMs: 1640, endMs: 1730 },
  { word: "so", startMs: 1790, endMs: 1920 },
  { word: "beautiful.", startMs: 1980, endMs: 2850 },
  { word: "The", startMs: 3450, endMs: 3580 },
  { word: "cherry", startMs: 3640, endMs: 4020 },
  { word: "blossoms", startMs: 4080, endMs: 4650 },
  { word: "are", startMs: 4710, endMs: 4850 },
  { word: "in", startMs: 4910, endMs: 4990 },
  { word: "full", startMs: 5050, endMs: 5260 },
  { word: "bloom,", startMs: 5320, endMs: 5890 },
  { word: "and", startMs: 6100, endMs: 6280 },
  { word: "every", startMs: 6340, endMs: 6620 },
  { word: "day", startMs: 6680, endMs: 6870 },
  { word: "brings", startMs: 6930, endMs: 7240 },
  { word: "new", startMs: 7300, endMs: 7480 },
  { word: "discoveries.", startMs: 7540, endMs: 8560 },
  { word: "The", startMs: 9150, endMs: 9280 },
  { word: "sushi", startMs: 9340, endMs: 9730 },
  { word: "is", startMs: 9790, endMs: 9880 },
  { word: "the", startMs: 9940, endMs: 10050 },
  { word: "best!", startMs: 10110, endMs: 10680 },
  { word: "With", startMs: 11200, endMs: 11440 },
  { word: "love,", startMs: 11500, endMs: 11900 },
  { word: "Kenta.", startMs: 11960, endMs: 13299 },
];

const santoriniTimings: SampleWordTiming[] = [
  { word: "Dear", startMs: 0, endMs: 280 },
  { word: "Dad,", startMs: 340, endMs: 880 },
  { word: "Santorini", startMs: 1080, endMs: 1820 },
  { word: "is", startMs: 1880, endMs: 1970 },
  { word: "a", startMs: 2030, endMs: 2090 },
  { word: "dream!", startMs: 2150, endMs: 2850 },
  { word: "The", startMs: 3450, endMs: 3580 },
  { word: "sea", startMs: 3640, endMs: 3900 },
  { word: "is", startMs: 3960, endMs: 4050 },
  { word: "so", startMs: 4110, endMs: 4250 },
  { word: "blue", startMs: 4310, endMs: 4650 },
  { word: "and", startMs: 4710, endMs: 4890 },
  { word: "the", startMs: 4950, endMs: 5060 },
  { word: "sunsets", startMs: 5120, endMs: 5620 },
  { word: "are", startMs: 5680, endMs: 5820 },
  { word: "breathtaking.", startMs: 5880, endMs: 6880 },
  { word: "I", startMs: 7480, endMs: 7540 },
  { word: "wish", startMs: 7600, endMs: 7850 },
  { word: "you", startMs: 7910, endMs: 8020 },
  { word: "were", startMs: 8080, endMs: 8280 },
  { word: "here.", startMs: 8340, endMs: 8920 },
  { word: "Many", startMs: 9520, endMs: 9780 },
  { word: "greetings,", startMs: 9840, endMs: 10520 },
  { word: "Anna.", startMs: 10580, endMs: 12228 },
];

export const samplePostcards: SamplePostcard[] = [
  {
    id: "sample-paris",
    title: "Paris, France",
    location: "Paris",
    language: "French",
    frontImage: require("@/assets/samples/paris_front.png"),
    backImage: require("@/assets/samples/paris_back.png"),
    originalText: "Chère Marie, Paris est magnifique! Les croissants sont délicieux et la Tour Eiffel brille chaque nuit. Je pense à toi. Bisous, Sophie.",
    translatedText: "Dear Marie, Paris is magnificent! The croissants are delicious and the Eiffel Tower shines every night. I think of you. Kisses, Sophie.",
    detectedLanguage: "French",
    description: "A scenic view of the Eiffel Tower in Paris at sunset, with the sun illuminating the city and the River Seine flowing through the cityscape.",
    words: ["Dear", "Marie,", "Paris", "is", "magnificent!", "The", "croissants", "are", "delicious", "and", "the", "Eiffel", "Tower", "shines", "every", "night.", "I", "think", "of", "you.", "Kisses,", "Sophie."],
    audioAsset: require("@/assets/samples/paris_audio.mp3"),
    durationMs: 11993,
    wordTimings: parisTimings,
  },
  {
    id: "sample-tokyo",
    title: "Tokyo, Japan",
    location: "Tokyo",
    language: "Japanese",
    frontImage: require("@/assets/samples/tokyo_front.png"),
    backImage: require("@/assets/samples/tokyo_back.png"),
    originalText: "親愛なるお母さん、東京はとても美しいです。桜が満開で、毎日新しい発見があります。お寿司が最高です！愛を込めて、健太",
    translatedText: "Dear Mom, Tokyo is so beautiful. The cherry blossoms are in full bloom, and every day brings new discoveries. The sushi is the best! With love, Kenta.",
    detectedLanguage: "Japanese",
    description: "A traditional Japanese pagoda framed by lush pink cherry blossom trees, with the snow-capped peak of Mount Fuji rising majestically in the background under a clear blue sky.",
    words: ["Dear", "Mom,", "Tokyo", "is", "so", "beautiful.", "The", "cherry", "blossoms", "are", "in", "full", "bloom,", "and", "every", "day", "brings", "new", "discoveries.", "The", "sushi", "is", "the", "best!", "With", "love,", "Kenta."],
    audioAsset: require("@/assets/samples/tokyo_audio.mp3"),
    durationMs: 13299,
    wordTimings: tokyoTimings,
  },
  {
    id: "sample-santorini",
    title: "Santorini, Greece",
    location: "Santorini",
    language: "German",
    frontImage: require("@/assets/samples/santorini_front.png"),
    backImage: require("@/assets/samples/santorini_back.png"),
    originalText: "Lieber Papa, Santorini ist ein Traum! Das Meer ist so blau und die Sonnenuntergänge sind atemberaubend. Ich wünschte du wärst hier. Viele Grüße, Anna.",
    translatedText: "Dear Dad, Santorini is a dream! The sea is so blue and the sunsets are breathtaking. I wish you were here. Many greetings, Anna.",
    detectedLanguage: "German",
    description: "Whitewashed buildings with distinctive blue domes perched on a cliffside in Santorini, overlooking the deep blue caldera with rocky islands visible in the distance.",
    words: ["Dear", "Dad,", "Santorini", "is", "a", "dream!", "The", "sea", "is", "so", "blue", "and", "the", "sunsets", "are", "breathtaking.", "I", "wish", "you", "were", "here.", "Many", "greetings,", "Anna."],
    audioAsset: require("@/assets/samples/santorini_audio.mp3"),
    durationMs: 12228,
    wordTimings: santoriniTimings,
  },
  {
    id: "sample-christmas",
    title: "Christmas Card",
    location: "Dresden",
    language: "German",
    frontImage: require("@/assets/samples/christmas_front.jpg"),
    backImage: require("@/assets/samples/christmas_back.jpg"),
    imageOnly: true,
  },
  {
    id: "sample-dresden-bw",
    title: "Dresden Views",
    location: "Dresden",
    language: "German",
    frontImage: require("@/assets/samples/dresden_bw_front.jpg"),
    backImage: require("@/assets/samples/dresden_bw_back.jpg"),
    imageOnly: true,
  },
  {
    id: "sample-dresden-color",
    title: "Dresden to Caribbean",
    location: "Dresden",
    language: "German",
    frontImage: require("@/assets/samples/dresden_color_front.jpg"),
    backImage: require("@/assets/samples/dresden_color_back.jpg"),
    imageOnly: true,
  },
  {
    id: "sample-standseilbahn",
    title: "Dresden Railway",
    location: "Dresden",
    language: "German",
    frontImage: require("@/assets/samples/standseilbahn_front.jpg"),
    backImage: require("@/assets/samples/standseilbahn_back.jpg"),
    imageOnly: true,
  },
  {
    id: "sample-neujahr",
    title: "New Year's Card",
    location: "Dresden",
    language: "German",
    frontImage: require("@/assets/samples/neujahr_front.jpg"),
    backImage: require("@/assets/samples/neujahr_back.jpg"),
    imageOnly: true,
  },
  {
    id: "sample-scouts",
    title: "Scout Camp 1934",
    location: "Germany",
    language: "German",
    frontImage: require("@/assets/samples/scouts_front.jpg"),
    backImage: require("@/assets/samples/scouts_back.jpg"),
    imageOnly: true,
  },
  {
    id: "sample-deer",
    title: "Deer Park",
    location: "Germany",
    language: "German",
    frontImage: require("@/assets/samples/deer_front.jpg"),
    backImage: require("@/assets/samples/deer_back.jpg"),
    imageOnly: true,
  },
  {
    id: "sample-dresden-letter",
    title: "Dresden Letter 1980",
    location: "Dresden",
    language: "German",
    frontImage: require("@/assets/samples/christmas_front.jpg"),
    backImage: require("@/assets/samples/dresden_letter_back.jpg"),
    imageOnly: true,
  },
];
