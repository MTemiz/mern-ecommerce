import { create } from "zustand";
import axios from "../lib/axios";
import { toast } from "react-hot-toast";

export const useUserStore = create((set, get) => ({
  user: null,
  loading: false,
  checkingAuth: true,

  signup: async ({ name, email, password, confirmPassword }) => {
    set({ loading: true });

    if (password !== confirmPassword) {
      set({ loading: false });
      return toast.error("Passwords do not match");
    }

    try {
      const res = await axios.post("/auth/signup", { name, email, password });
      set({ user: res.data, loading: false });
    } catch (error) {
      set({ loading: false });
      toast.error(error.response.data.message || "An error occurred");
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    console.log("login isteği");
    try {
      const res = await axios.post("/auth/login", { email, password });

      set({ user: res.data, loading: false });
      console.log("login isteği bitti");
    } catch (error) {
      set({ loading: false });
      toast.error(error.response.data.message || "An error occurred");
    }
  },

  checkAuth: async () => {
    set({ checkingAuth: true });
    try {
      const res = await axios.get("/auth/profile");
      console.log("checking auth", res.data);
      set({ user: res.data, checkingAuth: false });
    } catch (error) {
      console.log(error.message);
      set({ user: null, checkingAuth: false });
    }
  },

  logout: async () => {
    try {
      axios.post("/auth/logout");
      set({ user: null });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "An error occurred during logout"
      );
    }
  },

  refreshToken: async () => {
    //prevent multiple simultaneous reefresh attemps

    if (get().checkingAuth) return;

    set({ checkingAuth: true });

    try {
      const response = await axios.post("/auth/refresh-token");

      set({ checkingAuth: false });

      return response.data;
    } catch (error) {
      set({ user: null, checkingAuth: false });
      throw error;
    }
  },
}));

let refreshPromise = null;

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      try {
        originalRequest._retry = true;
        
        //if a refresh is already is progress, await for it to complete

        if (refreshPromise) {
          await refreshPromise;
          return axios(originalRequest);
        }

        //start a new refresh process
        refreshPromise = useUserStore.getState().refreshToken();
        await refreshPromise;
        refreshPromise = null;
        return axios(originalRequest);
      } catch (refreshError) {
        //if refresh fails, redirect to login or handle as needed
        useUserStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
