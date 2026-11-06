import { Participant, Expense, Transaction } from "./types";

/**
 * 한글 이름의 종성(받침) 유무에 따라 주격 조사 '이' 또는 '가'를 반환하는 함수
 * - 받침이 있으면: '이' (예: "선경" -> "선경이", "태환" -> "태환이", "🐯 선경" -> "선경이")
 * - 받침이 없으면: '가' (예: "신혜" -> "신혜가", "🌊 신혜" -> "신혜가", "지우" -> "지우가")
 */
export function getSubjectMarker(name: string): "이" | "가" {
  if (!name) return "이";

  // 문자열 내 모든 한글 음절(가-힣) 추출
  const hangulMatches = name.match(/[가-힣]/g);
  if (hangulMatches && hangulMatches.length > 0) {
    const lastHangulChar = hangulMatches[hangulMatches.length - 1];
    const code = lastHangulChar.charCodeAt(0) - 0xAC00;
    
    // 유효한 한글 음절 범위 확인 (0 ~ 11171)
    if (code >= 0 && code <= 11171) {
      const jongseongIndex = code % 28;
      // jongseongIndex > 0 이면 받침 있음
      return jongseongIndex > 0 ? "이" : "가";
    }
  }

  // 한글이 없는 영문/숫자 등의 경우 기본값
  return "이";
}

/**
 * 목적격 조사 '을' 또는 '를' 반환 함수
 */
export function getObjectMarker(name: string): "을" | "를" {
  if (!name) return "을";
  const hangulMatches = name.match(/[가-힣]/g);
  if (hangulMatches && hangulMatches.length > 0) {
    const lastHangulChar = hangulMatches[hangulMatches.length - 1];
    const code = lastHangulChar.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      return (code % 28) > 0 ? "을" : "를";
    }
  }
  return "을";
}

/**
 * 정산 금액을 계산하는 함수 (최소 거래 정산 알고리즘)
 */
export function calculateTransactions(
  participants: Participant[],
  expenses: Expense[]
): Transaction[] {
  const balances: { [id: string]: number } = {};

  // 참여자 잔고 초기화
  participants.forEach(p => {
    balances[p.id] = 0;
  });

  // 각 지출마다 지출자와 참가자 간의 밸런스 계산
  expenses.forEach(expense => {
    const payerId = expense.payerId;
    const amount = Number(expense.amount) || 0;
    const sharers = expense.participantIds;

    if (sharers.length === 0 || amount <= 0) return;

    // 지출한 사람은 전체 금액만큼 플러스 잔고를 얻음
    if (balances[payerId] !== undefined) {
      balances[payerId] += amount;
    }

    // 참가자들은 1/n 만큼 마이너스 잔고를 얻음
    const share = amount / sharers.length;
    sharers.forEach(sharerId => {
      if (balances[sharerId] !== undefined) {
        balances[sharerId] -= share;
      }
    });
  });

  // 잔고가 0이 아닌 사람들만 필터링
  const netBalances = participants.map(p => ({
    id: p.id,
    name: p.name,
    balance: balances[p.id] || 0
  })).filter(b => Math.abs(b.balance) > 0.1);

  // 돈을 줘야 하는 사람 (음수 잔고)
  const debtors = netBalances
    .filter(b => b.balance < 0)
    .map(b => ({ ...b, balance: -b.balance }))
    .sort((a, b) => b.balance - a.balance);

  // 돈을 받아야 하는 사람 (양수 잔고)
  const creditors = netBalances
    .filter(b => b.balance > 0)
    .map(b => ({ ...b, balance: b.balance }))
    .sort((a, b) => b.balance - a.balance);

  const transactions: Transaction[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amountToTransfer = Math.min(debtor.balance, creditor.balance);
    const roundedAmount = Math.round(amountToTransfer);

    if (roundedAmount > 0) {
      transactions.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: roundedAmount
      });
    }

    debtor.balance -= amountToTransfer;
    creditor.balance -= amountToTransfer;

    if (debtor.balance < 0.1) {
      dIdx++;
    }
    if (creditor.balance < 0.1) {
      cIdx++;
    }
  }

  return transactions;
}

/**
 * 숫자를 한국 원화 형식으로 포맷팅 (예: 15,000원)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW"
  }).format(value).replace("₩", "") + "원";
}

/**
 * 신대만달러(TWD / NT$) 포맷팅 (예: NT$ 350)
 */
export function formatTWD(value: number): string {
  return "NT$ " + new Intl.NumberFormat("en-US").format(Math.round(value));
}
