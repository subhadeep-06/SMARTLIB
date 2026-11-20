package com.smartlib.common;

import java.time.Instant;
import java.util.Map;

public record ApiResponse<T>(
        boolean success,
        T data,
        String message,
        Map<String, Object> meta,
        Instant timestamp
) {
    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, data, message, null, Instant.now());
    }

    public static <T> ApiResponse<T> error(String message, Map<String, Object> meta) {
        return new ApiResponse<>(false, null, message, meta, Instant.now());
    }
}
