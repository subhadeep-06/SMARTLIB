package com.smartlib.circulation;

import com.smartlib.inventory.BookCopyDocument;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

/**
 * Transactional circulation engine using atomic MongoTemplate conditional updates
 * to eliminate race conditions when issuing physical book copies.
 */
@Service
public class CirculationEngineService {

    public static final String DEFAULT_CURRENCY = "INR";

    private final MongoTemplate mongoTemplate;

    public CirculationEngineService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Transactional
    public BookCopyDocument atomicallyReserveCopyForIssue(String copyId, String branchId) {
        Query query = new Query(Criteria.where("_id").is(copyId)
                .and("branchId").is(branchId)
                .and("status").is(BookCopyDocument.CopyStatus.AVAILABLE));
        Update update = new Update()
                .set("status", BookCopyDocument.CopyStatus.ISSUED)
                .set("updatedAt", Instant.now());

        BookCopyDocument updated = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                BookCopyDocument.class
        );
        if (updated == null) {
            throw new IllegalStateException("Physical copy is unavailable or already issued concurrently.");
        }
        return updated;
    }

    public BigDecimal calculateOverdueFine(
            Instant dueDate,
            Instant returnedAt,
            int gracePeriodDays,
            BigDecimal finePerDay,
            BigDecimal maxFineAmount
    ) {
        if (finePerDay == null || finePerDay.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("finePerDay (INR) must be a non-negative monetary amount.");
        }
        if (maxFineAmount == null || maxFineAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("maxFineAmount (INR) must be a non-negative monetary amount.");
        }
        if (!returnedAt.isAfter(dueDate)) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        long overdueMillis = Duration.between(dueDate, returnedAt).toMillis();
        long rawDays = (long) Math.ceil(overdueMillis / (double) Duration.ofDays(1).toMillis());
        long billableDays = Math.max(0L, rawDays - Math.max(0, gracePeriodDays));
        BigDecimal computed = finePerDay.multiply(BigDecimal.valueOf(billableDays));
        return computed.min(maxFineAmount).setScale(2, RoundingMode.HALF_UP);
    }
}
