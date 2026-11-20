package com.smartlib;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableMongoAuditing
@EnableScheduling
public class SmartLibApplication {
    public static final String DEFAULT_COUNTRY = "India";
    public static final String DEFAULT_CURRENCY = "INR";
    public static final String DEFAULT_LOCALE = "en-IN";
    public static final String DEFAULT_TIMEZONE = "Asia/Kolkata";

    @PostConstruct
    void initTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone(DEFAULT_TIMEZONE));
    }

    public static void main(String[] args) {
        SpringApplication.run(SmartLibApplication.class, args);
    }
}
