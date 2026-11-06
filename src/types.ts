export interface Participant {
  id: string;
  name: string;
  emoji?: string;
}

export type TravelCategory = 
  | "flight"      // 항공료
  | "stay"        // 숙박비
  | "food"        // 식비
  | "snack"       // 간식비
  | "transport"   // 교통비
  | "sightseeing" // 관광/명소
  | "shopping"    // 쇼핑/선물
  | "etc";        // 기타

export interface Expense {
  id: string;
  title: string;       // 지출 항목 이름 (예: 춘수당 본점 밀크티, 고미습지 일몰 택시)
  amount: number;      // 원화(KRW) 환산 금액
  originalAmount?: number; // 현지 대만달러(TWD / NT$) 입력 금액
  currency?: "KRW" | "TWD"; // 입력 당시 통화
  payerId: string;     // 지출한 사람의 Participant ID
  participantIds: string[]; // 함께 나눌 사람들의 ID 목록
  date: string;        // 날짜 (YYYY-MM-DD)
  category?: TravelCategory; // 여행 카테고리
  note?: string;       // 비고 (예: "카드 결제", "영수증 보관")
}

export interface Transaction {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}
