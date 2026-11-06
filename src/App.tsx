import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  UserPlus,
  CheckCircle2,
  Wallet,
  MapPin,
  Share2,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Plane,
  Coffee,
  Utensils,
  Train,
  Home,
  Camera,
  ShoppingBag,
  Info
} from "lucide-react";
import { Participant, Expense, TravelCategory } from "./types";
import { calculateTransactions, formatCurrency, formatTWD, getSubjectMarker } from "./utils";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// 대만 타이중(Taichung) 여행 기본 초기 데이터
const INITIAL_PARTICIPANTS: Participant[] = [
  { id: "p1", name: "🌊 신혜" },
  { id: "p2", name: "🍵 지우" }
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: "e1",
    title: "타이중 그린라이프 부티크 호텔 (2박)",
    amount: 198000,
    originalAmount: 4710,
    currency: "KRW",
    payerId: "p1",
    participantIds: ["p1", "p2"],
    date: "2026-11-06",
    category: "stay",
    note: "타이중역 인근 숙소"
  },
  {
    id: "e2",
    title: "춘수당(春水堂) 본점 우육면 & 버블티",
    amount: 26000,
    originalAmount: 620,
    currency: "TWD",
    payerId: "p1",
    participantIds: ["p1", "p2"],
    date: "2026-11-06",
    category: "food",
    note: "버블 밀크티 발상지"
  },
  {
    id: "e3",
    title: "궁원안과(宮原眼科) 수제 아이스크림 세트",
    amount: 19500,
    originalAmount: 465,
    currency: "TWD",
    payerId: "p2",
    participantIds: ["p1", "p2"],
    date: "2026-11-07",
    category: "snack",
    note: "토핑 3가지 추가"
  },
  {
    id: "e4",
    title: "고미습지(高美濕地) 일몰 왕복 투어 택시",
    amount: 63000,
    originalAmount: 1500,
    currency: "TWD",
    payerId: "p2",
    participantIds: ["p1", "p2"],
    date: "2026-11-07",
    category: "transport",
    note: "풍차 일몰 스팟"
  },
  {
    id: "e5",
    title: "봉갑(펑지아) 야시장 지파이 & 고구마볼",
    amount: 32000,
    originalAmount: 760,
    currency: "TWD",
    payerId: "p1",
    participantIds: ["p1", "p2"],
    date: "2026-11-07",
    category: "food",
    note: "야시장 먹거리 투어"
  }
];

// 카테고리 설정 메타데이터: 항공료, 숙박비, 식비(디폴트), 간식비, 교통비, 관광/명소, 쇼핑/선물, 기타
const CATEGORIES: { id: TravelCategory; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: "flight", label: "항공료", icon: Plane, color: "bg-sky-500/10 text-sky-700 border-sky-300" },
  { id: "stay", label: "숙박비", icon: Home, color: "bg-indigo-500/10 text-indigo-700 border-indigo-300" },
  { id: "food", label: "식비", icon: Utensils, color: "bg-orange-500/10 text-orange-700 border-orange-300" },
  { id: "snack", label: "간식비", icon: Coffee, color: "bg-amber-500/10 text-amber-700 border-amber-300" },
  { id: "transport", label: "교통비", icon: Train, color: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  { id: "sightseeing", label: "관광/명소", icon: Camera, color: "bg-purple-500/10 text-purple-700 border-purple-300" },
  { id: "shopping", label: "쇼핑/선물", icon: ShoppingBag, color: "bg-rose-500/10 text-rose-700 border-rose-300" },
  { id: "etc", label: "기타", icon: Wallet, color: "bg-stone-500/10 text-stone-700 border-stone-300" }
];

const getRoomIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  return room ? room.trim() : "taichung_trip_2026";
};

// 고정 환율 기준 (1 TWD = 42 KRW)
const DEFAULT_EXCHANGE_RATE = 42;

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [completedTransactions, setCompletedTransactions] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);

  // 환율 설정
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  const [showExchangeEditor, setShowExchangeEditor] = useState(false);

  // 참가자 추가 입력 팝오버 상태
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");

  // 새 지출 양식 상태 (디폴트 카테고리: 식비 "food")
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseInputCurrency, setExpenseInputCurrency] = useState<"KRW" | "TWD">("KRW");
  const [expenseRawAmount, setExpenseRawAmount] = useState<number | "">("");
  const [expenseCategory, setExpenseCategory] = useState<TravelCategory>("food"); // 디폴트 식비
  const [expensePayerId, setExpensePayerId] = useState("");
  const [expenseSharers, setExpenseSharers] = useState<string[]>([]);
  const [expenseDate, setExpenseDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [expenseNote, setExpenseNote] = useState("");

  // 지출 내역 필터
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>("all");

  // 복사 완료 피드백 상태
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // 커스텀 토스트 알림 상태
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);

  // 커스텀 컨펌 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info" = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const askConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  // 1. Firebase 실시간 데이터 구독 및 초기화
  useEffect(() => {
    const roomId = getRoomIdFromUrl();
    const docRef = doc(db, "rooms", roomId);

    const unsubscribe = onSnapshot(
      docRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setParticipants(data.participants || []);
          setExpenses(data.expenses || []);
          setCompletedTransactions(data.completedTransactions || {});
          if (data.exchangeRate) setExchangeRate(data.exchangeRate);
          setLoading(false);
        } else {
          // 데이터가 없으면 대만 타이중 초기값으로 생성
          try {
            await setDoc(docRef, {
              participants: INITIAL_PARTICIPANTS,
              expenses: INITIAL_EXPENSES,
              completedTransactions: {},
              exchangeRate: DEFAULT_EXCHANGE_RATE,
              destination: "타이중 (Taichung, Taiwan)"
            });
          } catch (err) {
            console.error("Firebase init doc failed:", err);
          }
          setLoading(false);
        }
      },
      (error) => {
        console.error("Firestore sync error:", error);
        showToast("데이터 동기화 중 오류가 발생했습니다.", "error");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. 참여자 목록 변경 시 결제자 자동 지정 (신혜 또는 첫 번째 참여자)
  useEffect(() => {
    if (participants.length > 0) {
      if (!expensePayerId || !participants.some((p) => p.id === expensePayerId)) {
        const defaultPayer = participants.find((p) => p.name.includes("신혜")) || participants[0];
        setExpensePayerId(defaultPayer.id);
      }
      setExpenseSharers((prev) => {
        const activeIds = participants.map((p) => p.id);
        const validSharers = prev.filter((id) => activeIds.includes(id));
        return validSharers.length > 0 ? validSharers : activeIds;
      });
    }
  }, [participants, expensePayerId]);

  // Firestore 상태 업데이트 헬퍼
  const syncRoomData = async (
    newParts: Participant[],
    newExps: Expense[],
    newCompleted: { [key: string]: boolean },
    newRate?: number
  ) => {
    const roomId = getRoomIdFromUrl();
    const docRef = doc(db, "rooms", roomId);
    try {
      await setDoc(
        docRef,
        {
          participants: newParts,
          expenses: newExps,
          completedTransactions: newCompleted,
          exchangeRate: newRate ?? exchangeRate,
          lastUpdated: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Firestore save failed:", err);
      showToast("데이터 저장에 실패했습니다. 인터넷 연결을 확인해주세요.", "error");
    }
  };

  // 여행 친구 추가
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newParticipantName.trim();
    if (!trimmed) {
      showToast("친구 이름을 입력해주세요.", "error");
      return;
    }
    if (participants.some((p) => p.name === trimmed)) {
      showToast("이미 등록된 여행 친구 이름입니다.", "error");
      return;
    }

    const newParticipant: Participant = {
      id: "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: trimmed
    };

    const nextParticipants = [...participants, newParticipant];
    setParticipants(nextParticipants);
    setExpenseSharers((prev) => [...prev, newParticipant.id]);
    setNewParticipantName("");
    setShowAddParticipant(false);

    await syncRoomData(nextParticipants, expenses, completedTransactions);
    showToast(`✈️ '${trimmed}'님이 추가되었습니다!`, "success");
  };

  // 여행 친구 삭제
  const handleRemoveParticipant = (id: string, name: string) => {
    const hasExpenses = expenses.some((e) => e.payerId === id || e.participantIds.includes(id));
    if (hasExpenses) {
      showToast(`'${name}'님의 지출 내역이나 분담 기록이 있어 삭제할 수 없습니다.`, "error");
      return;
    }

    askConfirm(
      "여행 동행자 삭제",
      `'${name}'님을 여행 명단에서 삭제하시겠습니까?`,
      async () => {
        const nextParticipants = participants.filter((p) => p.id !== id);
        setParticipants(nextParticipants);
        await syncRoomData(nextParticipants, expenses, completedTransactions);
        showToast(`'${name}'님이 삭제되었습니다.`, "info");
      }
    );
  };

  // 원화 환산 계산
  const calculatedKrwAmount = useMemo(() => {
    if (typeof expenseRawAmount !== "number" || expenseRawAmount <= 0) return 0;
    if (expenseInputCurrency === "TWD") {
      return Math.round(expenseRawAmount * exchangeRate);
    }
    return Math.round(expenseRawAmount);
  }, [expenseRawAmount, expenseInputCurrency, exchangeRate]);

  // 새 지출 추가
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleTrimmed = expenseTitle.trim();
    if (!titleTrimmed) {
      showToast("지출 항목명을 입력해주세요.", "error");
      return;
    }
    if (!expenseRawAmount || expenseRawAmount <= 0) {
      showToast("유효한 결제 금액을 입력해주세요.", "error");
      return;
    }
    if (!expensePayerId) {
      showToast("결제한 친구를 선택해주세요.", "error");
      return;
    }
    if (expenseSharers.length === 0) {
      showToast("비용을 함께 나눌 친구를 1명 이상 선택해주세요.", "error");
      return;
    }

    const newExpense: Expense = {
      id: "e_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: titleTrimmed,
      amount: calculatedKrwAmount,
      originalAmount: expenseInputCurrency === "TWD" ? Number(expenseRawAmount) : undefined,
      currency: expenseInputCurrency,
      payerId: expensePayerId,
      participantIds: expenseSharers,
      date: expenseDate || new Date().toISOString().split("T")[0],
      category: expenseCategory,
      note: expenseNote.trim() || undefined
    };

    const nextExpenses = [newExpense, ...expenses];
    setExpenses(nextExpenses);
    setExpenseTitle("");
    setExpenseRawAmount("");
    setExpenseNote("");
    setExpenseCategory("food"); // 항상 디폴트 식비로 유지

    await syncRoomData(participants, nextExpenses, completedTransactions);
    showToast(`📝 '${titleTrimmed}' 지출이 등록되었습니다!`, "success");
  };

  // 지출 항목 삭제
  const handleRemoveExpense = (id: string, title: string) => {
    askConfirm(
      "지출 기록 삭제",
      `'${title}' 지출 내역을 삭제하시겠습니까?`,
      async () => {
        const nextExpenses = expenses.filter((e) => e.id !== id);
        setExpenses(nextExpenses);
        await syncRoomData(participants, nextExpenses, completedTransactions);
        showToast(`'${title}' 내역이 삭제되었습니다.`, "info");
      }
    );
  };

  // N빵 대상자 전체 선택 / 해제 토글
  const handleToggleSelectAllSharers = () => {
    if (expenseSharers.length === participants.length) {
      setExpenseSharers([]);
    } else {
      setExpenseSharers(participants.map((p) => p.id));
    }
  };

  // 송금 완료 체크 토글
  const handleToggleTransactionCompleted = async (key: string, currentStatus: boolean) => {
    const nextCompleted = {
      ...completedTransactions,
      [key]: !currentStatus
    };
    setCompletedTransactions(nextCompleted);
    await syncRoomData(participants, expenses, nextCompleted);
  };

  // 데이터 전체 초기화 (타이중 여행 샘플 데이터로 복구)
  const handleResetToSample = () => {
    askConfirm(
      "타이중 여행 데이터 초기화",
      "현재 작성된 모든 지출과 참여자 정보를 대만 타이중 여행 기본 샘플로 되돌릴까요?",
      async () => {
        setParticipants(INITIAL_PARTICIPANTS);
        setExpenses(INITIAL_EXPENSES);
        setCompletedTransactions({});
        setExchangeRate(DEFAULT_EXCHANGE_RATE);
        await syncRoomData(INITIAL_PARTICIPANTS, INITIAL_EXPENSES, {}, DEFAULT_EXCHANGE_RATE);
        showToast("🇹🇼 타이중 여행 기본 데이터로 재설정되었습니다.", "success");
      }
    );
  };

  // 정산 알고리즘 계산
  const transactions = useMemo(() => {
    return calculateTransactions(participants, expenses);
  }, [participants, expenses]);

  // 총 지출 및 개인별 통계 계산
  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenses]);

  const totalSpentTwd = useMemo(() => {
    return Math.round(totalSpent / exchangeRate);
  }, [totalSpent, exchangeRate]);

  const perPersonAverage = useMemo(() => {
    return participants.length > 0 ? Math.round(totalSpent / participants.length) : 0;
  }, [totalSpent, participants.length]);

  // 카테고리 필터링된 지출 목록
  const filteredExpenses = useMemo(() => {
    if (selectedFilterCategory === "all") return expenses;
    return expenses.filter((e) => (e.category || "etc") === selectedFilterCategory);
  }, [expenses, selectedFilterCategory]);

  // 개인별 지출/부담 밸런스 맵
  const participantBalances = useMemo(() => {
    const map: { [id: string]: { paid: number; shouldPay: number; net: number } } = {};
    participants.forEach((p) => {
      map[p.id] = { paid: 0, shouldPay: 0, net: 0 };
    });

    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      if (map[e.payerId]) {
        map[e.payerId].paid += amt;
      }
      if (e.participantIds.length > 0) {
        const share = amt / e.participantIds.length;
        e.participantIds.forEach((pid) => {
          if (map[pid]) {
            map[pid].shouldPay += share;
          }
        });
      }
    });

    Object.keys(map).forEach((id) => {
      map[id].net = Math.round(map[id].paid - map[id].shouldPay);
    });

    return map;
  }, [participants, expenses]);

  // 클립보드에 정산 결과 복사 (카톡/메신저 공유용)
  const handleCopySettlementText = () => {
    if (transactions.length === 0) {
      showToast("복사할 정산 내역이 없습니다.", "info");
      return;
    }

    let text = `🇹🇼 [대만 타이중 여행 최종 정산 안내]\n`;
    text += `총 경비: ${formatCurrency(totalSpent)} (NT$ ${totalSpentTwd.toLocaleString()})\n`;
    text += `참여 인원: ${participants.length}명 (1인 평균 ${formatCurrency(perPersonAverage)})\n\n`;
    text += `📋 송금 정산 내역:\n`;

    transactions.forEach((t, idx) => {
      const marker = getSubjectMarker(t.fromName);
      const isDone = completedTransactions[`${t.fromId}-${t.toId}-${t.amount}`];
      text += `${idx + 1}. ${t.fromName}${marker} ${t.toName}에게 ${formatCurrency(t.amount)} 송금 (${formatTWD(t.amount / exchangeRate)}) ${isDone ? "✅ [완료]" : "⏳ [미송금]"}\n`;
    });

    text += `\n대만 타이중 여행 정산 완료! ✨`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedSummary(true);
      showToast("카카오톡/메신저 공유용 정산 내역이 복사되었습니다!", "success");
      setTimeout(() => setCopiedSummary(false), 2500);
    });
  };

  // 현재 방 링크 복사
  const handleCopyRoomUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedUrl(true);
      showToast("동행자와 함께 보는 실시간 정산 링크가 복사되었습니다!", "success");
      setTimeout(() => setCopiedUrl(false), 2500);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#E8734A]/10 border-2 border-[#E8734A]/30 flex items-center justify-center mb-4 animate-bounce">
          <Plane className="w-8 h-8 text-[#E8734A]" />
        </div>
        <h2 className="text-xl font-bold text-[#2C241D]">타이중 여행 경비 불러오는 중...</h2>
        <p className="text-sm text-[#7D7164] mt-1 font-mono">Taichung, Taiwan 🇹🇼 · Realtime Cloud Sync</p>
      </div>
    );
  }

  const currentRoomId = getRoomIdFromUrl();

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#2C241D] flex flex-col font-sans pb-16">
      {/* 1. 상단 깔끔한 헤더 바 */}
      <header className="border-b border-[#E3DAC9] bg-[#FFFFFF]/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* 타이틀 & 목적지 배지 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E8734A] to-[#C9532B] text-white flex items-center justify-center shadow-md shadow-[#E8734A]/20 font-bold text-lg">
              🇹🇼
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-[#231A12] flex items-center gap-1.5">
                  타이중 여행 정산기
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E8734A]/10 text-[#C9532B] border border-[#E8734A]/30">
                    대만 타이중
                  </span>
                </h1>
              </div>
              <p className="text-xs text-[#7A6E63] flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#E8734A]" />
                Taichung Travel Split · 실시간 경비 정산
              </p>
            </div>
          </div>

          {/* 환율 & 방 관리/공유 버튼 */}
          <div className="flex items-center gap-2">
            {/* 환율 표시 및 설정 버튼 */}
            <div className="relative">
              <button
                onClick={() => setShowExchangeEditor(!showExchangeEditor)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F3EDE2] hover:bg-[#EAE2D4] border border-[#DDD3C1] text-xs font-semibold text-[#5A4E41] transition-colors"
                title="환율 설정"
              >
                <span className="text-emerald-700 font-bold">1 NT$</span>
                <span className="text-[#8C7E6F]">≒</span>
                <span className="font-bold text-[#2C241D]">{exchangeRate}원</span>
                <span className="text-[10px] text-[#A6998A]">⚙️</span>
              </button>

              {/* 환율 수정 팝오버 */}
              {showExchangeEditor && (
                <div className="absolute right-0 mt-2 p-3 bg-white rounded-xl shadow-xl border border-[#E0D7C6] z-50 w-56">
                  <div className="text-xs font-bold text-[#2C241D] mb-1.5 flex items-center justify-between">
                    <span>적용 환율 설정 (KRW/TWD)</span>
                    <button
                      onClick={() => setShowExchangeEditor(false)}
                      className="text-stone-400 hover:text-stone-600 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">1 NT$ =</span>
                    <input
                      type="number"
                      value={exchangeRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val > 0) setExchangeRate(val);
                      }}
                      className="w-20 px-2 py-1 text-xs border border-stone-300 rounded font-bold"
                    />
                    <span className="text-xs font-bold">원</span>
                  </div>
                  <div className="mt-2 text-[10px] text-stone-500 bg-amber-50 p-1.5 rounded border border-amber-200">
                    현재 대만 달러는 1 TWD당 약 41~43원 내외입니다.
                  </div>
                </div>
              )}
            </div>

            {/* 샘플 복구 버튼 */}
            <button
              onClick={handleResetToSample}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-[#F3EDE2] transition-colors"
              title="타이중 초기 샘플로 리셋"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* 실시간 룸 공유 버튼 */}
            <button
              onClick={handleCopyRoomUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C241D] hover:bg-[#42372D] text-white text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? "복사됨!" : "동행 초대"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. 메인 콘텐츠 컨테이너 */}
      <main className="max-w-6xl mx-auto px-4 py-6 w-full flex-1">
        {/* 대시보드 요약 지표 카드: 총 여행 경비 & 1인당 평균 경비 (2열) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
          {/* 총 지출 */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3DAC9] shadow-xs relative overflow-hidden">
            <div className="text-xs font-semibold text-[#8C7E6F] mb-1">총 여행 경비</div>
            <div className="text-2xl sm:text-3xl font-black text-[#231A12] tracking-tight">
              {formatCurrency(totalSpent)}
            </div>
            <div className="text-xs font-bold text-[#E8734A] mt-1">
              ≈ {formatTWD(totalSpentTwd)}
            </div>
          </div>

          {/* 1인당 평균 경비 (요청: '(N빵)' 글자 제거 완료) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3DAC9] shadow-xs relative overflow-hidden">
            <div className="text-xs font-semibold text-[#8C7E6F] mb-1">1인당 평균 경비</div>
            <div className="text-2xl sm:text-3xl font-black text-[#231A12] tracking-tight">
              {formatCurrency(perPersonAverage)}
            </div>
            <div className="text-xs font-bold text-stone-500 mt-1">
              {participants.length}명 기준 (약 {formatTWD(perPersonAverage / exchangeRate)})
            </div>
          </div>
        </div>

        {/* 메인 2열 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* =========================================
              좌측 열 (5 cols): 여행 친구(가로 2명) & 새 지출 입력
              ========================================= */}
          <div className="lg:col-span-5 space-y-4">
            {/* A. 여행 친구: 컴팩트 가로 2명 박스 (요청: 신혜 디폴트 라벨 제거 완료) */}
            <div className="bg-white rounded-2xl border border-[#E3DAC9] p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#6A5E52] flex items-center gap-1.5">
                  <span>👥</span> 함께하는 여행 친구 ({participants.length}명)
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddParticipant(!showAddParticipant)}
                  className="text-[11px] font-bold text-[#E8734A] hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>친구 추가</span>
                </button>
              </div>

              {/* 추가 입력 팝다운 */}
              {showAddParticipant && (
                <form onSubmit={handleAddParticipant} className="flex gap-2 mb-2.5 pt-1">
                  <input
                    type="text"
                    placeholder="친구 이름 (예: 🏮 민수)"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-xl border border-[#DDD3C1] bg-white font-medium focus:ring-2 focus:ring-[#E8734A]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-[#E8734A] text-white text-xs font-bold shrink-0"
                  >
                    추가
                  </button>
                </form>
              )}

              {/* 가로 2명(grid-cols-2) 컴팩트 리스트 */}
              <div className="grid grid-cols-2 gap-2">
                {participants.map((p) => {
                  const balance = participantBalances[p.id] || { paid: 0, shouldPay: 0, net: 0 };
                  const isNetPositive = balance.net > 0;
                  const isNetZero = balance.net === 0;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#FAF7F0] border border-[#EAE3D5] text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-6 h-6 rounded-full bg-white border border-[#DDD3C1] flex items-center justify-center font-bold text-[11px] shrink-0">
                          {p.name.slice(0, 2)}
                        </div>
                        <span className="font-bold text-[#231A12] truncate">{p.name}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isNetZero
                              ? "bg-stone-200/70 text-stone-600"
                              : isNetPositive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {isNetZero
                            ? "0원"
                            : isNetPositive
                            ? `+${formatCurrency(balance.net)}`
                            : `-${formatCurrency(Math.abs(balance.net))}`}
                        </span>

                        {participants.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(p.id, p.name)}
                            className="text-stone-300 hover:text-rose-500 p-0.5"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* B. 새 여행 지출 입력 카드 */}
            <div className="bg-white rounded-2xl border border-[#E3DAC9] p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F0EAE0]">
                <span className="w-6 h-6 rounded-lg bg-[#E8734A]/10 text-[#C9532B] flex items-center justify-center text-xs font-bold">
                  ✍️
                </span>
                <h2 className="font-bold text-base text-[#231A12]">새 여행 지출 기록하기</h2>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                {/* 1. 카테고리 빠른 선택 (요청: 항공료 숙박비 식비 간식비 교통비 관광/명소 쇼핑/선물 기타, 디폴트: 식비) */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-[#6A5E52]">
                      카테고리 선택
                    </label>
                    <span className="text-[11px] text-amber-700 font-medium">기본값: 식비</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = expenseCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setExpenseCategory(cat.id)}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-[11px] font-bold transition-all ${
                            isSelected
                              ? "bg-[#2C241D] text-white border-[#2C241D] shadow-xs scale-102"
                              : "bg-[#FAF7F0] text-[#6A5E52] border-[#E5DED0] hover:bg-[#F3EDE2]"
                          }`}
                        >
                          <Icon className="w-4 h-4 mb-1" />
                          <span className="truncate w-full text-center">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 지출 항목명 */}
                <div>
                  <label className="block text-xs font-bold text-[#6A5E52] mb-1">
                    어디에 썼나요? (지출 항목)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 춘수당 우육면 2인분, 택시비"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDD3C1] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#E8734A] focus:border-transparent placeholder:text-stone-400 font-medium"
                  />
                </div>

                {/* 3. 결제 금액 & 통화 선택 (NT$ 대만달러 또는 ₩ 원화) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-[#6A5E52]">
                      결제 금액
                    </label>
                    {/* 통화 탭 */}
                    <div className="flex bg-[#F3EDE2] p-0.5 rounded-lg border border-[#DDD3C1] text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setExpenseInputCurrency("TWD")}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          expenseInputCurrency === "TWD"
                            ? "bg-[#E8734A] text-white shadow-2xs"
                            : "text-[#6A5E52] hover:text-[#2C241D]"
                        }`}
                      >
                        🇹🇼 NT$ (대만달러)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseInputCurrency("KRW")}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          expenseInputCurrency === "KRW"
                            ? "bg-[#E8734A] text-white shadow-2xs"
                            : "text-[#6A5E52] hover:text-[#2C241D]"
                        }`}
                      >
                        🇰🇷 ₩ (원화)
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder={expenseInputCurrency === "TWD" ? "예: 620" : "예: 26000"}
                      value={expenseRawAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExpenseRawAmount(val === "" ? "" : Number(val));
                      }}
                      className="w-full pl-3 pr-14 py-2 text-sm rounded-xl border border-[#DDD3C1] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#E8734A] focus:border-transparent font-bold text-[#231A12]"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-[#8C7E6F]">
                      {expenseInputCurrency === "TWD" ? "NT$" : "원"}
                    </span>
                  </div>

                  {/* 실시간 환산 프리뷰 */}
                  {typeof expenseRawAmount === "number" && expenseRawAmount > 0 && (
                    <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-[#FAF5EC] border border-[#EADBCA] text-xs flex items-center justify-between text-[#7A6451]">
                      <span>환산 기준 (1 NT$ = {exchangeRate}원):</span>
                      <span className="font-bold text-[#C9532B]">
                        {expenseInputCurrency === "TWD"
                          ? `약 ${formatCurrency(calculatedKrwAmount)}`
                          : `약 ${formatTWD(expenseRawAmount / exchangeRate)}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. 결제한 사람 */}
                <div>
                  <label className="block text-xs font-bold text-[#6A5E52] mb-1">
                    누가 먼저 결제했나요?
                  </label>
                  <select
                    value={expensePayerId}
                    onChange={(e) => setExpensePayerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDD3C1] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#E8734A] focus:border-transparent font-bold text-[#231A12]"
                  >
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. 함께 나눌 사람 */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-[#6A5E52]">
                      누구와 함께 나눌까요?
                    </label>
                    <button
                      type="button"
                      onClick={handleToggleSelectAllSharers}
                      className="text-[11px] font-bold text-[#E8734A] hover:underline"
                    >
                      {expenseSharers.length === participants.length ? "선택 해제" : "모두 선택"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {participants.map((p) => {
                      const isChecked = expenseSharers.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            isChecked
                              ? "bg-[#FAF5EC] border-[#E8734A] text-[#2C241D]"
                              : "bg-white border-[#E0D7C6] text-[#8C7E6F] opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExpenseSharers([...expenseSharers, p.id]);
                              } else {
                                setExpenseSharers(expenseSharers.filter((id) => id !== p.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-[#E8734A] focus:ring-[#E8734A]"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 6. 날짜 및 간단 메모 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-[#6A5E52] mb-1">
                      결제 일자
                    </label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-[#DDD3C1] bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#6A5E52] mb-1">
                      간단 메모 (선택)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 트래블월렛"
                      value={expenseNote}
                      onChange={(e) => setExpenseNote(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-[#DDD3C1] bg-white font-medium placeholder:text-stone-400"
                    />
                  </div>
                </div>

                {/* 제출 버튼 */}
                <button
                  type="submit"
                  disabled={participants.length === 0}
                  className="w-full py-2.5 rounded-xl bg-[#2C241D] hover:bg-[#42372D] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2C241D]/10 transition-all active:scale-98 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4 text-[#E8734A]" />
                  <span>지출 내역 추가하기</span>
                </button>
              </form>
            </div>
          </div>

          {/* =========================================
              우측 열 (7 cols): 최종 정산(Final Settlement) & 상세 지출 목록
              ========================================= */}
          <div className="lg:col-span-7 space-y-6">
            {/* C. FINAL SETTLEMENT (최종 송금 정산 내역 - 받침 조사 이/가 완벽 적용) */}
            <div className="bg-gradient-to-br from-[#2C241D] to-[#1C1712] rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-[#3E342B] relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#E8734A]/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* 헤더 섹션 */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-white/10 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E8734A] text-white text-[11px] font-black uppercase tracking-wider">
                      FINAL SETTLEMENT
                    </span>
                    <span className="text-xs text-amber-200/80 font-medium">최종 송금 안내</span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-white mt-1">
                    누가 누구에게 얼마를 보낼까요?
                  </h3>
                </div>

                {/* 카톡/메신저 공유 복사 버튼 */}
                <button
                  onClick={handleCopySettlementText}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-100 border border-white/15 transition-all active:scale-95 shrink-0"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>복사 완료!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-300" />
                      <span>카톡 공유 텍스트 복사</span>
                    </>
                  )}
                </button>
              </div>

              {/* 정산 카드 리스트 */}
              <div className="space-y-3 relative z-10">
                {transactions.length === 0 ? (
                  <div className="bg-white/5 rounded-2xl p-8 text-center text-xs text-stone-300 border border-white/10 flex flex-col items-center justify-center">
                    <span className="text-3xl mb-2">🎉</span>
                    {expenses.length === 0 ? (
                      <p>아직 등록된 지출 내역이 없습니다. 왼쪽 폼에서 첫 지출을 기록해보세요!</p>
                    ) : (
                      <p>모든 참가자가 완벽하게 정산을 맞추어 송금할 정산금이 없습니다!</p>
                    )}
                  </div>
                ) : (
                  transactions.map((t) => {
                    const key = `${t.fromId}-${t.toId}-${t.amount}`;
                    const isChecked = completedTransactions[key] || false;
                    const marker = getSubjectMarker(t.fromName); // 받침 있으면 "이", 없으면 "가"
                    const twdEquiv = Math.round(t.amount / exchangeRate);

                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleToggleTransactionCompleted(key, isChecked)}
                        className={`group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isChecked
                            ? "bg-white/5 border-white/10 opacity-40"
                            : "bg-white/10 hover:bg-white/15 border-white/20 hover:border-amber-400/40 shadow-sm"
                        }`}
                      >
                        {/* 정산 문장: 받침 규칙 적용 (이 / 가) */}
                        <div className="flex items-center gap-2 text-sm sm:text-base">
                          {/* 송금하는 사람 */}
                          <div className="flex items-center gap-1">
                            <span
                              className={`font-black tracking-tight ${
                                isChecked ? "line-through text-stone-400" : "text-white"
                              }`}
                            >
                              {t.fromName}
                            </span>
                            {/* 받침 규칙 조사 표기 */}
                            <span className="text-[#FF9F76] font-bold text-xs sm:text-sm px-1 py-0.2 rounded bg-white/10">
                              {marker}
                            </span>
                          </div>

                          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

                          {/* 송금받는 사람 */}
                          <div className="flex items-center gap-1">
                            <span
                              className={`font-black tracking-tight ${
                                isChecked ? "line-through text-stone-400" : "text-amber-200"
                              }`}
                            >
                              {t.toName}
                            </span>
                            <span className="text-stone-300 font-semibold text-xs sm:text-sm">
                              에게
                            </span>
                          </div>
                        </div>

                        {/* 송금할 금액 & 체크 버튼 */}
                        <div className="flex items-center justify-between sm:justify-end gap-3.5 pt-2 sm:pt-0 border-t border-white/10 sm:border-0">
                          <div className="text-right">
                            <div
                              className={`font-mono text-base sm:text-lg font-black tracking-tight ${
                                isChecked ? "line-through text-stone-400" : "text-white"
                              }`}
                            >
                              {formatCurrency(t.amount)}
                            </div>
                            <div className="text-[11px] font-bold text-amber-300/80">
                              {formatTWD(twdEquiv)}
                            </div>
                          </div>

                          {/* 송금 완료 토글 체크박스 */}
                          <div
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                              isChecked
                                ? "bg-emerald-500 border-emerald-400 text-white"
                                : "border-white/40 text-transparent group-hover:border-white"
                            }`}
                            title={isChecked ? "정산 완료됨 (클릭하여 취소)" : "클릭하여 정산 완료 표시"}
                          >
                            <CheckCircle2 className="w-4 h-4 fill-current" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* 하단 안내 문구 */}
              {transactions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-stone-400 flex items-center justify-between">
                  <span>💡 카드를 누르면 송금 완료 상태로 체크할 수 있습니다.</span>
                  <span className="text-amber-300/80">대만 타이중 환율(1 NT$ = {exchangeRate}원) 적용</span>
                </div>
              )}
            </div>

            {/* D. 여행 상세 지출 기록 (Travel Ledger & Table) */}
            <div className="bg-white rounded-2xl border border-[#E3DAC9] p-5 shadow-xs overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#E8734A]/10 text-[#C9532B] flex items-center justify-center text-xs font-bold">
                    📜
                  </span>
                  <h3 className="font-bold text-base text-[#231A12]">상세 지출 내역</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F3EDE2] text-[#6A5E52]">
                    {filteredExpenses.length}건
                  </span>
                </div>

                {/* 카테고리 필터 탭 */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 scrollbar-none text-[11px] font-bold">
                  <button
                    onClick={() => setSelectedFilterCategory("all")}
                    className={`px-2 py-1 rounded-lg transition-colors ${
                      selectedFilterCategory === "all"
                        ? "bg-[#2C241D] text-white"
                        : "bg-[#F3EDE2] text-[#6A5E52] hover:bg-[#EAE2D4]"
                    }`}
                  >
                    전체
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedFilterCategory(cat.id)}
                      className={`px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                        selectedFilterCategory === cat.id
                          ? "bg-[#E8734A] text-white"
                          : "bg-[#F3EDE2] text-[#6A5E52] hover:bg-[#EAE2D4]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 지출 목록 */}
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-12 text-xs text-stone-400 bg-[#FAF7F0] rounded-xl border border-dashed border-[#E3DAC9]">
                  해당 카테고리의 지출 내역이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-[#F0EAE0] max-h-[460px] overflow-y-auto pr-1">
                  {filteredExpenses.map((expense) => {
                    const payer = participants.find((p) => p.id === expense.payerId);
                    const payerName = payer ? payer.name : "알 수 없음";
                    const catMeta = CATEGORIES.find((c) => c.id === expense.category) || CATEGORIES[7];
                    const CatIcon = catMeta.icon;
                    const sharerNames = expense.participantIds
                      .map((id) => participants.find((p) => p.id === id)?.name)
                      .filter(Boolean);

                    return (
                      <div
                        key={expense.id}
                        className="py-3.5 flex items-start justify-between gap-3 hover:bg-[#FAF7F0] px-2 rounded-xl transition-colors"
                      >
                        {/* 좌측 정보: 카테고리 아이콘 + 항목명 + 세부 정보 */}
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${catMeta.color}`}>
                            <CatIcon className="w-4 h-4" />
                          </div>

                          <div>
                            <div className="font-bold text-sm text-[#231A12] flex items-center gap-2">
                              <span>{expense.title}</span>
                              {expense.note && (
                                <span className="text-[10px] font-normal text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded">
                                  {expense.note}
                                </span>
                              )}
                            </div>

                            {/* 결제자 및 날짜 (요청: '모두 함께 N빵' 문구 삭제 완료) */}
                            <div className="text-xs text-[#7A6E63] mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-[#2C241D] bg-[#F3EDE2] px-1.5 py-0.2 rounded">
                                결제: {payerName}
                              </span>
                              {sharerNames.length < participants.length && (
                                <>
                                  <span>·</span>
                                  <span className="text-stone-500">
                                    {sharerNames.join(", ")} 분담
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span className="font-mono text-[11px] text-stone-400">{expense.date}</span>
                            </div>
                          </div>
                        </div>

                        {/* 우측 금액 및 삭제 */}
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div>
                            <div className="font-bold text-sm text-[#231A12]">
                              {formatCurrency(expense.amount)}
                            </div>
                            <div className="text-[11px] font-semibold text-[#E8734A]">
                              {expense.originalAmount && expense.currency === "TWD"
                                ? formatTWD(expense.originalAmount)
                                : formatTWD(expense.amount / exchangeRate)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveExpense(expense.id, expense.title)}
                            className="text-stone-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="지출 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 3. 커스텀 컨펌 모달 (window.confirm 대체) */}
      <AnimatePresence>
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200"
            >
              <h3 className="font-bold text-base text-stone-900 mb-2">{confirmModal.title}</h3>
              <p className="text-xs text-stone-600 mb-5 leading-relaxed">{confirmModal.message}</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. 커스텀 토스트 알림 (window.alert 대체) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl text-xs font-bold shadow-xl border flex items-center gap-2 max-w-md ${
              toast.type === "error"
                ? "bg-rose-600 text-white border-rose-700"
                : toast.type === "success"
                ? "bg-stone-900 text-white border-stone-800"
                : "bg-stone-800 text-white border-stone-700"
            }`}
          >
            {toast.type === "success" && <Check className="w-4 h-4 text-emerald-400" />}
            {toast.type === "error" && <Info className="w-4 h-4 text-rose-300" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
