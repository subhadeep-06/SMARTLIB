package com.smartlib.seat;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Concurrency-safe Smart Seat Reservation conflict checker and scheduled no-show release job.
 */
@Service
public class SeatConflictService {

    private final MongoTemplate mongoTemplate;

    public SeatConflictService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Transactional
    public void assertNoTimeSlotOverlap(String seatId, String userId, LocalDate date, LocalTime start, LocalTime end) {
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("End time must be after start time.");
        }
        Criteria overlap = new Criteria().andOperator(
                Criteria.where("reservationDate").is(date.toString()),
                Criteria.where("status").in(List.of("CONFIRMED", "CHECKED_IN")),
                Criteria.where("startTime").lt(end.toString()),
                Criteria.where("endTime").gt(start.toString()),
                new Criteria().orOperator(
                        Criteria.where("seatId").is(seatId),
                        Criteria.where("userId").is(userId)
                )
        );
        boolean conflictExists = mongoTemplate.exists(new Query(overlap), "seat_reservations");
        if (conflictExists) {
            throw new IllegalStateException("Seat or member already holds an overlapping confirmed reservation.");
        }
    }

    @Scheduled(fixedDelayString = "300000")
    public void expireUncheckedInReservations() {
        Query expiredQuery = new Query(Criteria.where("status").is("CONFIRMED")
                .and("checkInDeadline").lt(Instant.now()));
        var update = new org.springframework.data.mongodb.core.query.Update()
                .set("status", "EXPIRED")
                .set("updatedAt", Instant.now());
        mongoTemplate.updateMulti(expiredQuery, update, "seat_reservations");
    }
}
