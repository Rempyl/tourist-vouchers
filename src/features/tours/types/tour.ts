// path: src/features/tours/types/tour.ts

/** Туристическая путёвка. startDate — дата вылета YYYY-MM-DD, price — цена за одного человека в рублях. */
export interface Tour {
  id: string;
  title: string;
  country: string;
  startDate: string;
  nights: number;
  price: number;
  /** Всего мест в туре. */
  seats: number;
  /** Сколько мест уже занято бронированиями. */
  seatsBooked: number;
}

/** Данные для создания тура (id и seatsBooked назначает бэкенд). */
export interface NewTour {
  title: string;
  country: string;
  startDate: string;
  nights: number;
  price: number;
  seats: number;
}

/** Значения полей формы тура: до проверки это всегда строки. */
export interface TourFormValues {
  title: string;
  country: string;
  startDate: string;
  nights: string;
  price: string;
  seats: string;
}

/** Бронирование текущего пользователя. */
export interface Booking {
  id: string;
  tourId: string;
  guests: number;
  createdAt: string;
}
